import http.server
import socketserver
import json
import os

PORT = 8000

class GameServerHandler(http.server.SimpleHTTPRequestHandler):
    
    # SimpleHTTPRequestHandler automatically handles GET requests (serving your HTML/JS/CSS).
    # We only need to override do_POST to handle your saveMapToDisk() fetch call.
    def do_POST(self):
        try:
            # 1. Get the size of the incoming data
            content_length = int(self.headers['Content-Length'])
            
            # 2. Read and decode the incoming JSON payload
            post_data = self.rfile.read(content_length)
            map_data = json.loads(post_data.decode('utf-8'))
            
            # 3. Write it out to config.js in standard ES6 Module format
            with open('config.js', 'w') as f:
                f.write("// Procedurally generated map save file\n")
                f.write("export const data = ")
                f.write(json.dumps(map_data, indent=4))
                f.write(";\n")
            
            # 4. Send a successful response back to the browser
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "success", "message": "Map saved to config.js"}')
            
            print(f"[*] Map saved successfully! ({len(map_data)} blocks)")
            
        except Exception as e:
            # Handle any errors cleanly without crashing the server
            print(f"[!] Error saving map: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "error", "message": "Failed to save map"}')

if __name__ == "__main__":
    # Ensure config.js exists before starting (prevents import errors in JS)
    if not os.path.exists('config.js'):
        with open('config.js', 'w') as f:
            f.write("export const data = [];\n")
            print("[*] Created empty config.js file.")

    # Start the local server
    with socketserver.TCPServer(("", PORT), GameServerHandler) as httpd:
        print(f"[*] Thin Game Server running at: http://localhost:{PORT}")
        print("[*] Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[*] Server stopped.")