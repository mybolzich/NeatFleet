"""
Vercel Python serverless function: POST /api/optimize

Production entrypoint for the OR-Tools VRP solver. Vercel's Python runtime
picks up any `api/*.py` file that defines a BaseHTTPRequestHandler subclass
named `handler` — no framework needed. Requires `ortools` in requirements.txt
at the repo root (Vercel installs it automatically at build time).
"""
import json
from http.server import BaseHTTPRequestHandler

from _solver_core import solve


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            payload = json.loads(body)

            result = solve(payload)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
        except Exception as err:  # noqa: BLE001 — surface solver errors to the caller
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(err)}).encode('utf-8'))
