"""
Local-dev entrypoint: reads a JSON payload from stdin, solves it with
OR-Tools, writes the JSON result to stdout. Spawned by server.ts's
/api/optimize route via child_process so `npm run dev` gets real OR-Tools
optimization without needing Vercel's Python runtime locally.

Usage: python3 api/optimize_cli.py < payload.json
"""
import json
import sys

from _solver_core import solve

if __name__ == '__main__':
    payload = json.load(sys.stdin)
    result = solve(payload)
    json.dump(result, sys.stdout)
