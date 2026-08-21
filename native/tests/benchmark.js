'use strict';

/**
 * benchmark.js — Speed comparison benchmark: native_image addon vs sharp.
 *
 * Generates WebP test images at 3 sizes, decodes each 20× with both
 * implementations, and reports avg / median / min / max in a formatted table.
 *
 * Usage:  node tests/benchmark.js
 *
 * If the native module is not available the script runs sharp-only
 * benchmarks and reports that the native module was not found.
 */

const path = require('path');
const sharp = require('sharp');

// ── Configuration ────────────────────────────────────────────────────────

const ITERATIONS = 20;

const SIZES = [
  { label: '292\u00D7136',        w: 292, h: 136 },
  { label: '460\u00D7215',        w: 460, h: 215 },
  { label: '920\u00D7430',        w: 920, h: 430 },
];

// ── Native module loader ─────────────────────────────────────────────────

function loadNativeModule() {
  const candidates = [
    path.join(__dirname, '..', 'build', 'Release', 'native_image'),
    path.join(__dirname, '..', 'build', 'Release', 'native_image.node'),
    path.join(__dirname, '..', '..', 'electron', 'native', 'native_image'),
    path.join(__dirname, '..', '..', 'electron', 'native', 'native_image.node'),
    path.join(__dirname, '..', 'build', 'Release', 'ahg-native-image'),
    path.join(__dirname, '..', 'build', 'Release', 'ahg-native-image.node'),
    path.join(__dirname, '..', '..', 'electron', 'native', 'ahg-native-image'),
    path.join(__dirname, '..', '..', 'electron', 'native', 'ahg-native-image.node'),
  ];

  for (const p of candidates) {
    try {
      const mod = require(p);
      if (mod && typeof mod.decodeWebP === 'function') {
        return mod;
      }
    } catch {
      // Try next
    }
  }
  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Deterministic pseudo-random RGBA buffer (different seed per size) */
function createTestRgba(w, h, seed) {
  const data = Buffer.alloc(w * h * 4);
  let s = seed;
  for (let i = 0; i < w * h * 4; i++) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    data[i] = s & 0xff;
  }
  return data;
}

/** Generate a WebP buffer from random RGBA data */
async function generateWebpFixture(w, h, seed) {
  const rgba = createTestRgba(w, h, seed);
  const buf = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 85 })
    .toBuffer();
  return { rgba, webpBuf: buf, w, h };
}

/** Run sync function N times, return { avg, median, min, max } in ms */
function runBenchmark(label, fn, iterations) {
  const times = [];

  // Warmup
  for (let i = 0; i < 5; i++) fn();

  // Timed runs
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    fn();
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1e6);
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  const median = times[Math.floor(times.length / 2)];
  const min = times[0];
  const max = times[times.length - 1];

  return { avg, median, min, max };
}

/** Run async function N times */
async function runBenchmarkAsync(label, fn, iterations) {
  const times = [];

  // Warmup
  for (let i = 0; i < 5; i++) await fn();

  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    await fn();
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1e6);
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  const median = times[Math.floor(times.length / 2)];
  const min = times[0];
  const max = times[times.length - 1];

  return { avg, median, min, max };
}

// ── Table rendering ──────────────────────────────────────────────────────

function pad(s, width) {
  const str = String(s);
  const len = [...str].length; // Unicode-aware length
  return str + ' '.repeat(Math.max(0, width - len));
}

function line(parts) {
  return '\u2502 ' + parts.map((p, i) => pad(p, [16, 10, 10, 10][i])).join(' \u2502 ') + ' \u2502';
}

function headerSep(left, mid, right) {
  const colWidths = [16, 10, 10, 10];
  const segments = colWidths.map(w => '\u2500'.repeat(w + 2));
  return `${left}${segments.join(mid)}${right}`;
}

function renderTable(rows, showNative) {
  const out = [];
  const sep = headerSep('\u250C', '\u252C', '\u2510');
  const sepMid = headerSep('\u251C', '\u253C', '\u2524');
  const sepEnd = headerSep('\u2514', '\u2534', '\u2518');

  out.push(sep);
  if (showNative) {
    out.push(line(['Size', 'Native', 'Sharp', 'Speedup']));
  } else {
    // 3-column table without Native column
    out.push('\u2502 ' + pad('Size', 16) + ' \u2502 ' + pad('Sharp (ms)', 22) + ' \u2502');
  }
  out.push(sepMid);

  for (const r of rows) {
    if (showNative) {
      const speedup = r.sharpAvg / r.nativeAvg;
      const speedupStr = speedup > 1 ? `${speedup.toFixed(1)}\u00D7` : 'N/A';
      out.push(line([r.label, r.nativeAvg.toFixed(2), r.sharpAvg.toFixed(2), speedupStr]));
    } else {
      out.push(`\u2502 ${pad(r.label, 16)} \u2502 ${pad(`${r.sharpAvg.toFixed(2)} ms  (med ${r.sharpMed.toFixed(2)})`, 22)} \u2502`);
    }
  }

  out.push(sepEnd);
  return out.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== AHG Native Image Addon Benchmark ===\n');

  const nativeAddon = loadNativeModule();
  const hasNative = nativeAddon !== null;

  console.log(`Native module: ${hasNative ? '\u2705 available' : '\u26A0\uFE0F not available'}\n`);

  // ── Generate fixtures ──
  console.log('Generating test fixtures...');
  const fixtures = await Promise.all(
    SIZES.map(s => generateWebpFixture(s.w, s.h, s.w * s.h))
  );
  console.log(`  ${fixtures.length} fixtures created\n`);

  // ── Benchmark loop ──
  const rows = [];

  for (let i = 0; i < fixtures.length; i++) {
    const { label, w, h } = SIZES[i];
    const { webpBuf } = fixtures[i];

    let nativeResult = null;
    let sharpResult = null;

    // Native decode
    if (hasNative) {
      const nr = runBenchmark(
        `  Native ${label}`,
        () => { nativeAddon.decodeWebP(webpBuf); },
        ITERATIONS
      );
      nativeResult = nr;
      console.log(`  Native ${label}: avg=${nr.avg.toFixed(2)}ms  med=${nr.median.toFixed(2)}ms  min=${nr.min.toFixed(2)}ms  max=${nr.max.toFixed(2)}ms`);
    }

    // Sharp decode
    const sr = await runBenchmarkAsync(
      `  Sharp  ${label}`,
      async () => {
        const img = sharp(webpBuf);
        await img.metadata();
        await img.ensureAlpha().raw().toBuffer();
      },
      ITERATIONS
    );
    sharpResult = sr;
    console.log(`  Sharp  ${label}: avg=${sr.avg.toFixed(2)}ms  med=${sr.median.toFixed(2)}ms  min=${sr.min.toFixed(2)}ms  max=${sr.max.toFixed(2)}ms`);

    rows.push({
      label,
      nativeAvg: nativeResult ? nativeResult.avg : 0,
      sharpAvg: sr.avg,
      sharpMed: sr.median,
    });

    console.log('');
  }

  // ── Results table ──
  if (hasNative) {
    console.log('Decode Speed (ms, lower is better)');
    console.log(renderTable(rows, true));

    // Also show detailed stats
    console.log('\nDetailed statistics:\n');
    for (const r of rows) {
      const speedup = r.sharpAvg / r.nativeAvg;
      console.log(`  ${r.label}:  native ${r.nativeAvg.toFixed(2)}ms  vs  sharp ${r.sharpAvg.toFixed(2)}ms  =  ${speedup.toFixed(1)}\u00D7 ${speedup > 1 ? 'faster' : 'slower'}`);
    }
  } else {
    console.log('Sharp decode only results (native module unavailable):\n');
    console.log(renderTable(rows, false));
  }

  console.log('\n=== Benchmark complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
