import http.server, os

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, format, *args):
        pass  # suppress request noise

os.chdir(os.path.dirname(os.path.abspath(__file__)))
http.server.HTTPServer(('', 8080), Handler).serve_forever()
