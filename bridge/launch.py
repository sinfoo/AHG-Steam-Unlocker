"""
AHG Unlocker Launcher
Simple HTTP server that serves the React frontend
"""

import os
import sys
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
import socketserver
import threading
import time

PORT = 5173
UI_DIR = os.path.join(os.path.dirname(__file__), "ui", "dist")

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def start_server():
    """Start the HTTP server"""
    os.chdir(UI_DIR)
    
    with HTTPServer(('localhost', PORT), CORSRequestHandler) as httpd:
        print(f"🚀 AHG Unlocker running at http://localhost:{PORT}")
        print(f"📁 Serving from: {UI_DIR}")
        print("\nPress Ctrl+C to stop the server\n")
        httpd.serve_forever()

def open_browser():
    """Open browser after a short delay"""
    time.sleep(1)
    webbrowser.open(f'http://localhost:{PORT}')

if __name__ == "__main__":
    print("=" * 50)
    print("   AHG UNLOCKER v1.0 - React Edition")
    print("=" * 50)
    print()
    
    # Check if dist exists
    if not os.path.exists(UI_DIR):
        print("❌ React app not built!")
        print("   Run: cd ui && npm run build")
        sys.exit(1)
    
    # Start server and open browser
    threading.Thread(target=open_browser, daemon=True).start()
    
    try:
        start_server()
    except KeyboardInterrupt:
        print("\n👋 Shutting down...")
        sys.exit(0)