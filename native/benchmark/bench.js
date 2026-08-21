'use strict';

/**
 * bench.js — Benchmark native_image addon vs sharp fallback.
 *
 * Tests decode, encode, LQIP, batch decode, and full pipeline (decode+encode+LQIP)
 * on realistic game-cover sized images (460×215, 600×900).
 *
 * Usage: node benchmark/bench.js
 *
 * Results are printed as a markdown table.
 */

const path = require('path');
const sharp = require('sharp');

// ── Load native addon directly (avoid index.js promise-wrapping for more precise timing) ──
let nativeAddon;
try {
  nativeAddon = require('../build/Release/native_image');
  console.log('✓ Native addon loaded');
} catch (e) {
  console.error('✗ Failed to load native addon:', e.message);
  process.exit(1);
}

// ── Test image dimensions (realistic game cover sizes) ──
const SIZES = [
  { label: 'Small (header)',  w: 460, h: 215 },   // Steam header.jpg
  { label: 'Medium (portrait)', w: 600, h: 900 },  // Steam portrait/capsule
  { label: 'Large (full)',   w: 920, h: 430 },     // 2× header
];

// Helper: create random RGBA pixel data
function createTestRgba(w, h, seed = 42) {
  const data = Buffer.alloc(w * h * 4);
  // Deterministic pseudo-random for reproducibility
  let s = seed;
  for (let i = 0; i < w * h * 4; i++) {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    data[i] = (s >>> 24) & 0xFF;
  }
  return data;
}

// ── Generate test fixtures (encoded WebP and JPEG files) ──
async function generateFixtures() {
  const fixtures = {};

  for (const { label, w, h } of SIZES) {
    const rgba = createTestRgba(w, h, 42);

    // Encode WebP via native addon (synchronous)
    const webpBuf = nativeAddon.encodeWebP(rgba, w, h, 85);

    // Encode JPEG via sharp
    const jpegBuf = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
      .jpeg({ quality: 85 })
      .toBuffer();

    fixtures[label] = { w, h, rgba, webpBuf, jpegBuf };
  }

  return fixtures;
}

// ── Benchmark helpers ──

/** Run fn() N times, return { avg, median, min, max, p95 } in ms */
function benchmark(label, fn, iterations = 100) {
  const times = [];

  // Warmup
  for (let i = 0; i < 10; i++) fn();

  // Timed runs
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    fn();
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1e6); // ms
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  const median = times[Math.floor(times.length / 2)];
  const min = times[0];
  const max = times[times.length - 1];
  const p95 = times[Math.floor(times.length * 0.95)];

  console.log(`  ${label}: avg=${avg.toFixed(2)}ms median=${median.toFixed(2)}ms min=${min.toFixed(2)}ms max=${max.toFixed(2)}ms p95=${p95.toFixed(2)}ms`);
  return { avg, median, min, max, p95 };
}

/** Run async function N times */
async function benchmarkAsync(label, fn, iterations = 100) {
  const times = [];

  // Warmup
  for (let i = 0; i < 10; i++) await fn();

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
  const p95 = times[Math.floor(times.length * 0.95)];

  console.log(`  ${label}: avg=${avg.toFixed(2)}ms median=${median.toFixed(2)}ms min=${min.toFixed(2)}ms max=${max.toFixed(2)}ms p95=${p95.toFixed(2)}ms`);
  return { avg, median, min, max, p95 };
}

// ── Run benchmarks ──

function printResults(name, native, sharp) {
  if (!sharp) {
    console.log(`| ${name} | ${native.avg.toFixed(2)}ms | N/A | N/A |`);
    return;
  }
  const ratio = sharp.avg / native.avg;
  const label = ratio > 1 ? `**${ratio.toFixed(2)}× faster**` : `${ratio.toFixed(2)}× slower`;
  console.log(`| ${name} | ${native.avg.toFixed(2)}ms | ${sharp.avg.toFixed(2)}ms | ${label} |`);
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  🔬 Native Image Addon — Performance Benchmark');
  console.log('══════════════════════════════════════════════════════════════\n');

  console.log('Generating test fixtures...\n');
  const fixtures = await generateFixtures();
  console.log(`  Generated ${Object.keys(fixtures).length} fixture sizes\n`);

  // ── 1. Decode WebP ──
  console.log('─── 1. WebP Decode ───\n');
  const wDecodeResults = {};

  for (const [label, { w, h, webpBuf }] of Object.entries(fixtures)) {

    console.log(`  [${label} ${w}×${h}]`);

    // Native
    const nRes = benchmark(`  Native`, () => {
      nativeAddon.decodeWebP(webpBuf);
    }, 200);

    // Sharp
    const sRes = await benchmarkAsync(`  Sharp `, async () => {
      const img = sharp(webpBuf);
      await img.metadata();
      await img.ensureAlpha().raw().toBuffer();
    }, 200);

    wDecodeResults[label] = { native: nRes, sharp: sRes };
    console.log('');
  }

  // ── 2. Decode JPEG ──
  console.log('─── 2. JPEG Decode ───\n');
  const jDecodeResults = {};

  for (const [label, { w, h, jpegBuf }] of Object.entries(fixtures)) {

    console.log(`  [${label} ${w}×${h}]`);

    // Native
    const nRes = benchmark(`  Native`, () => {
      nativeAddon.decodeJPEG(jpegBuf);
    }, 200);

    // Sharp
    const sRes = await benchmarkAsync(`  Sharp `, async () => {
      const img = sharp(jpegBuf);
      await img.metadata();
      await img.ensureAlpha().raw().toBuffer();
    }, 200);

    jDecodeResults[label] = { native: nRes, sharp: sRes };
    console.log('');
  }

  // ── 3. Encode WebP ──
  console.log('─── 3. WebP Encode ───\n');
  const encodeResults = {};

  for (const [label, { w, h, rgba }] of Object.entries(fixtures)) {

    console.log(`  [${label} ${w}×${h}]`);

    // Native
    const nRes = benchmark(`  Native`, () => {
      nativeAddon.encodeWebP(rgba, w, h, 85);
    }, 200);

    // Sharp
    const sRes = await benchmarkAsync(`  Sharp `, async () => {
      await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
        .webp({ quality: 85 })
        .toBuffer();
    }, 200);

    encodeResults[label] = { native: nRes, sharp: sRes };
    console.log('');
  }

  // ── 4. Generate LQIP ──
  console.log('─── 4. LQIP Generation ───\n');
  const lqipResults = {};

  for (const [label, { w, h, rgba }] of Object.entries(fixtures)) {

    console.log(`  [${label} ${w}×${h}]`);

    // Native
    const nRes = benchmark(`  Native`, () => {
      nativeAddon.generateLQIP(rgba, w, h, 20);
    }, 200);

    // Sharp
    const sRes = await benchmarkAsync(`  Sharp `, async () => {
      await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
        .resize(20, 20, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 20 })
        .toBuffer();
    }, 200);

    lqipResults[label] = { native: nRes, sharp: sRes };
    console.log('');
  }

  // ── 5. Full pipeline: decode + encode + LQIP (simulates convertToWebP) ──
  console.log('─── 5. Full Pipeline (Decode WebP → Encode WebP → LQIP) ───\n');
  const pipelineResults = {};

  for (const [label, { w, h, webpBuf }] of Object.entries(fixtures)) {

    console.log(`  [${label} ${w}×${h}]`);

    // Native: decode → encode → LQIP
    const nRes = benchmark(`  Native`, () => {
      const decoded = nativeAddon.decodeWebP(webpBuf);
      nativeAddon.encodeWebP(decoded.data, decoded.width, decoded.height, 82);
      nativeAddon.generateLQIP(decoded.data, decoded.width, decoded.height, 20);
    }, 100);

    // Sharp: decode → encode → LQIP
    const sRes = await benchmarkAsync(`  Sharp `, async () => {
      const img = sharp(webpBuf);
      const meta = await img.metadata();
      const rgba = await img.ensureAlpha().raw().toBuffer();
      await sharp(rgba, { raw: { width: meta.width, height: meta.height, channels: 4 } })
        .webp({ quality: 82 })
        .toBuffer();
      await sharp(rgba, { raw: { width: meta.width, height: meta.height, channels: 4 } })
        .resize(20, 20, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 20 })
        .toBuffer();
    }, 100);

    pipelineResults[label] = { native: nRes, sharp: sRes };
    console.log('');
  }

  // ── 6. Batch decode ──
  console.log('─── 6. Batch Decode (8 images) ───\n');
  const batchResults = {};

  for (const [label, { w, h, webpBuf }] of Object.entries(fixtures)) {
    const batchInputs = Array.from({ length: 8 }, () => ({ data: webpBuf, type: 'webp' }));

    console.log(`  [${label} ${w}×${h} × 8]`);

    // Native (thread pool)
    const nRes = benchmark(`  Native`, () => {
      nativeAddon.batchDecode(batchInputs, 4);
    }, 50);

    // Sharp (concurrency 4)
    const sRes = await benchmarkAsync(`  Sharp `, async () => {
      async function worker(queue) {
        while (queue.length > 0) {
          const idx = queue.shift();
          const data = batchInputs[idx].data;
          const img = sharp(data);
          const meta = await img.metadata();
          await img.ensureAlpha().raw().toBuffer();
        }
      }
      const indices = batchInputs.map((_, i) => i);
      const workers = [];
      for (let i = 0; i < 4; i++) {
        workers.push(worker(indices));
      }
      await Promise.all(workers);
    }, 50);

    batchResults[label] = { native: nRes, sharp: sRes };
    console.log('');
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Results Table
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  📊 Results Summary');
  console.log('══════════════════════════════════════════════════════════════\n');

  const allLabels = Object.keys(fixtures);

  console.log('### 1. WebP Decode (avg ms)\n');
  console.log('| Size | Native | Sharp | Speedup |');
  console.log('|------|--------|-------|---------|');
  for (const label of allLabels) {
    const r = wDecodeResults[label];
    printResults(label, r.native, r.sharp);
  }

  console.log('\n### 2. JPEG Decode (avg ms)\n');
  console.log('| Size | Native | Sharp | Speedup |');
  console.log('|------|--------|-------|---------|');
  for (const label of allLabels) {
    const r = jDecodeResults[label];
    printResults(label, r.native, r.sharp);
  }

  console.log('\n### 3. WebP Encode (avg ms)\n');
  console.log('| Size | Native | Sharp | Speedup |');
  console.log('|------|--------|-------|---------|');
  for (const label of allLabels) {
    const r = encodeResults[label];
    printResults(label, r.native, r.sharp);
  }

  console.log('\n### 4. LQIP Generation (avg ms)\n');
  console.log('| Size | Native | Sharp | Speedup |');
  console.log('|------|--------|-------|---------|');
  for (const label of allLabels) {
    const r = lqipResults[label];
    printResults(label, r.native, r.sharp);
  }

  console.log('\n### 5. Full Pipeline — Decode + Encode + LQIP (avg ms)\n');
  console.log('| Size | Native | Sharp | Speedup |');
  console.log('|------|--------|-------|---------|');
  for (const label of allLabels) {
    const r = pipelineResults[label];
    printResults(label, r.native, r.sharp);
  }

  console.log('\n### 6. Batch Decode × 8 (avg ms)\n');
  console.log('| Size | Native | Sharp | Speedup |');
  console.log('|------|--------|-------|---------|');
  for (const label of allLabels) {
    const r = batchResults[label];
    printResults(label, r.native, r.sharp);
  }

  console.log('\n');
}

main().catch(err => { console.error(err); process.exit(1); });
