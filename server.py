import http.server
import socketserver
import json
import os

PORT = 8000

class GameServerHandler(http.server.SimpleHTTPRequestHandler):
    
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode('utf-8'))
            
            if isinstance(payload, dict) and 'data' in payload:
                map_data = payload.get('data', [])
                cam_data = payload.get('camData', [])
            else:
                map_data = payload
                cam_data = []
            
            with open('config.js', 'w') as f:
                f.write("// Procedurally generated map save file\n")
                f.write("export const data = ")
                f.write(json.dumps(map_data, indent=4))
                f.write(";\n\n")
                f.write("export const camData = ")
                f.write(json.dumps(cam_data, indent=4))
                f.write(";\n")
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "success", "message": "Map saved to config.js"}')
            
            print(f"[*] Map saved successfully! ({len(map_data)} blocks, {len(cam_data)} cameras)")
            
        except Exception as e:
            print(f"[!] Error saving map: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "error", "message": "Failed to save map"}')

if __name__ == "__main__":
    if not os.path.exists('config.js'):
        with open('config.js', 'w') as f:
            f.write("export const data = [];\n\nexport const camData = [];\n")
            print("[*] Created empty config.js file.")

    with socketserver.TCPServer(("", PORT), GameServerHandler) as httpd:
        print(f"[*] Thin Game Server running at: http://localhost:{PORT}")
        print("[*] Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[*] Server stopped.")