
socket = __import__('sys').modules['builtin_importers'] if False else __import__('socket')

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind(('127.0.0.1', 5000))
server.listen(1)

print("listening on http://127.0.0.1:5000...")

while True:
    client_conn, addr = server.accept()
    request = client_conn.recv(4096).decode('utf-8')
    
    if not request:
        client_conn.close()
        continue
        
    header_part, _, body_part = request.partition('\r\n\r\n')
    
    if "POST / " in header_part:
        # Handle saving the file
        with open("config.js", "w") as f:
            f.write(f"export const data = {body_part.strip()};")
        client_conn.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n")
        
    elif "GET /config.js" in header_part:
        # FIX: Serve the JS file with the proper JavaScript MIME type header
        try:
            with open("config.js", "r") as f:
                js_data = f.read()
            response = f"HTTP/1.1 200 OK\r\nContent-Type: application/javascript\r\nContent-Length: {len(js_data)}\r\n\r\n{js_data}"
            client_conn.sendall(response.encode('utf-8'))
        except:
            client_conn.sendall(b"HTTP/1.1 404 Not Found\r\n\r\n")
            
    else:
        # Serve the HTML page
        try:
            with open("index.html", "r") as f:
                html = f.read()
            response = f"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {len(html)}\r\n\r\n{html}"
            client_conn.sendall(response.encode('utf-8'))
        except:
            client_conn.sendall(b"HTTP/1.1 404 Not Found\r\n\r\n")
            
    client_conn.close()