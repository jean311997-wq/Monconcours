"""Petit serveur local pour l'audit : sert le dépôt en lecture seule, avec compression gzip comme le ferait l'hébergeur."""
import gzip, http.server, os, sys, mimetypes, socketserver

RACINE = sys.argv[2]
PORT = int(sys.argv[1])
COMPRESSIBLE = ('.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt')

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=RACINE, **k)
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def do_GET(self):
        chemin = self.translate_path(self.path.split('?')[0])
        if os.path.isdir(chemin): chemin = os.path.join(chemin, 'index.html')
        if os.path.isfile(chemin) and chemin.endswith(COMPRESSIBLE) and 'gzip' in self.headers.get('Accept-Encoding', ''):
            corps = gzip.compress(open(chemin, 'rb').read(), 6)
            self.send_response(200)
            self.send_header('Content-Type', (mimetypes.guess_type(chemin)[0] or 'application/octet-stream') + ('; charset=utf-8' if chemin.endswith(('.html', '.js', '.css')) else ''))
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Content-Length', str(len(corps)))
            self.end_headers(); self.wfile.write(corps); return
        super().do_GET()

class S(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

S(('127.0.0.1', PORT), H).serve_forever()
