"""
AHG Unlocker Performance Analysis Script
Launches the Electron app with remote debugging, connects via Playwright,
and captures performance metrics, screenshots, and button analysis.
"""
import sys
import os
import json
import time
import subprocess
from playwright.sync_api import sync_playwright, TimeoutError as PwTimeout

APP_PATH = r"C:\Users\USER\Downloads\filesOPENCODE\dev-release\win-unpacked\AHG Unlocker.exe"
DEBUG_PORT = 9222
REPORT_DIR = r"C:\Users\USER\Downloads\filesOPENCODE\perf-report"
os.makedirs(REPORT_DIR, exist_ok=True)

def log(msg):
    print(f"[PERF] {msg}")
    with open(os.path.join(REPORT_DIR, "analysis.log"), "a") as f:
        f.write(f"{time.strftime('%H:%M:%S')} {msg}\n")

def launch_app():
    """Launch the Electron app with remote debugging port."""
    log(f"Launching app: {APP_PATH}")
    proc = subprocess.Popen(
        [APP_PATH, f"--remote-debugging-port={DEBUG_PORT}"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        shell=True
    )
    time.sleep(8)  # Wait for app to initialize
    log(f"App launched with PID {proc.pid}")
    return proc

def connect_browser(p, timeout_ms=15000):
    """Connect to the app via CDP on the debugging port."""
    endpoint = f"http://127.0.0.1:{DEBUG_PORT}/json/version"
    log(f"Connecting to CDP at {endpoint}")
    browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{DEBUG_PORT}")
    return browser

def collect_metrics(page, label):
    """Collect JS heap, DOM node count, and layout metrics."""
    metrics = page.evaluate("""() => {
        return {
            jsHeapSize: performance.memory?.usedJSHeapSize || 0,
            domNodes: document.querySelectorAll('*').length,
            buttons: document.querySelectorAll('button').length,
            interactive: document.querySelectorAll('button, a, input, select, textarea, [role=button]').length,
            images: document.querySelectorAll('img').length,
            eventListeners: window.__LISTENER_COUNT__ || 0,
        }
    }""")
    
    # Get frame rate / compositing info
    timing = page.evaluate("""() => {
        const nav = performance.getEntriesByType('navigation')[0];
        return {
            domContentLoaded: nav ? nav.domContentLoadedEventEnd : 0,
            loadTime: nav ? nav.loadEventEnd : 0,
            domInteractive: nav ? nav.domInteractive : 0,
        }
    }""")
    
    result = {
        "label": label,
        "jsHeapMB": round(metrics["jsHeapSize"] / 1048576, 1),
        "domNodes": metrics["domNodes"],
        "buttons": metrics["buttons"],
        "interactiveElements": metrics["interactive"],
        "images": metrics["images"],
        "timing": timing,
    }
    log(f"  [{label}] JS Heap: {result['jsHeapMB']}MB | DOM: {result['domNodes']} | Buttons: {result['buttons']}")
    return result

def enumerate_buttons(page, label):
    """Find all buttons and their event handlers."""
    buttons = page.evaluate("""() => {
        const allButtons = document.querySelectorAll('button, [role=button], a.btn');
        return Array.from(allButtons).slice(0, 50).map((btn, i) => {
            const rect = btn.getBoundingClientRect();
            const styles = window.getComputedStyle(btn);
            const hasClickHandler = btn.onclick !== null || 
                btn.getAttribute('ng-click') ||
                btn.getAttribute('v-on:click') ||
                (btn.__reactProps$ && (btn.__reactProps$.onClick || btn.__reactProps$.onPointerDown));
            const hasListener = typeof btn.onclick === 'function';
            return {
                index: i,
                tag: btn.tagName,
                id: btn.id || '',
                text: (btn.textContent || '').trim().substring(0, 40),
                classes: btn.className?.substring(0, 60) || '',
                visible: rect.width > 0 && rect.height > 0,
                rect: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                hasClickHandler: !!hasClickHandler,
                hasListener: !!hasListener,
                zIndex: styles.zIndex,
                position: styles.position,
                transform: styles.transform ? 'yes' : 'no',
                willChange: styles.willChange || '',
                opacity: styles.opacity,
            };
        });
    }""")
    
    with open(os.path.join(REPORT_DIR, f"buttons_{label}.json"), "w") as f:
        json.dump(buttons, f, indent=2)
    log(f"  Found {len(buttons)} buttons (first 50)")
    return buttons

def capture_screenshot(page, label):
    """Take a full-page screenshot."""
    path = os.path.join(REPORT_DIR, f"screenshot_{label}.png")
    page.screenshot(path=path, full_page=True)
    log(f"  Screenshot saved: {path}")
    return path

def check_react_perf(page):
    """Check for React performance warnings via console logs."""
    logs = []
    def handle_console(msg):
        text = msg.text
        if any(kw in text.lower() for kw in ['warning', 'error', 'performance', 're-render', 'slow', 'lag']):
            logs.append(text)
    
    page.on("console", handle_console)
    return logs

def interact_with_app(browser):
    """Navigate through the app and collect data at each page."""
    page = browser.pages[0] if browser.pages else browser.new_page()
    page.set_default_timeout(10000)
    
    # Wait for initial render
    try:
        page.wait_for_load_state("networkidle", timeout=10000)
    except PwTimeout:
        log("  Warning: networkidle timeout on initial load")
    
    time.sleep(2)  # Let animations settle
    log("\n=== Initial State ===")
    metrics_all = []
    
    # 1. Home page
    m = collect_metrics(page, "home")
    metrics_all.append(m)
    btns = enumerate_buttons(page, "home")
    capture_screenshot(page, "home")
    
    # 2. Try clicking Browse nav link
    for link_text in ["Browse", "browse", "LIBRARY", "Library", "Fixes", "Settings"]:
        try:
            link = page.get_by_role("link", name=link_text).first
            if link:
                link.click(timeout=3000)
                time.sleep(2)
                page.wait_for_load_state("networkidle", timeout=5000)
                m = collect_metrics(page, link_text.lower())
                metrics_all.append(m)
                enumerate_buttons(page, link_text.lower())
                capture_screenshot(page, link_text.lower())
        except Exception as e:
            log(f"  Could not click '{link_text}': {e}")
    
    # 3. Try clicking any visible button
    try:
        buttons = page.locator("button").all()
        for i, btn in enumerate(buttons[:10]):
            try:
                text = btn.text_content() or ""
                vis = btn.is_visible()
                if vis and text.strip():
                    log(f"  Clicking button [{i}]: '{text.strip()[:30]}'")
                    btn.click(timeout=3000)
                    time.sleep(1.5)
                    m = collect_metrics(page, f"btn_{text.strip()[:15]}")
                    metrics_all.append(m)
                    capture_screenshot(page, f"btn_{i}")
            except Exception:
                pass
    except Exception as e:
        log(f"  Button iteration error: {e}")
    
    return metrics_all

def main():
    log("=" * 60)
    log("AHG Unlocker Performance Analysis")
    log("=" * 60)
    
    proc = launch_app()
    
    try:
        with sync_playwright() as p:
            browser = None
            for attempt in range(5):
                try:
                    browser = connect_browser(p)
                    log("Connected successfully!")
                    break
                except Exception as e:
                    log(f"Connection attempt {attempt+1} failed: {e}")
                    time.sleep(3)
            
            if not browser:
                log("FATAL: Could not connect to app")
                return
            
            try:
                metrics = interact_with_app(browser)
            finally:
                browser.close()
    
    finally:
        log("\n--- App cleanup ---")
        proc.terminate()
        time.sleep(1)
        if proc.poll() is None:
            proc.kill()
    
    # Generate report
    log("\n" + "=" * 60)
    log("SUMMARY REPORT")
    log("=" * 60)
    with open(os.path.join(REPORT_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    
    for m in metrics:
        log(f"  {m['label']:20s} | Heap: {m['jsHeapMB']:>5}MB | DOM: {m['domNodes']:>5} | Buttons: {m['buttons']:>3}")
    
    log(f"\nReport saved to: {REPORT_DIR}")

if __name__ == "__main__":
    main()
