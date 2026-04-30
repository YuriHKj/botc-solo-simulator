from __future__ import annotations

import http.server
import socket
import threading
from functools import partial
from pathlib import Path
import sys

import webview


def resource_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent


def find_open_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def start_local_server(root: Path):
    port = find_open_port()
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, port


def main() -> None:
    root = resource_root()
    server, port = start_local_server(root)
    url = f"http://127.0.0.1:{port}/index.html"

    try:
        webview.create_window(
            title="BOTC Solo Simulator",
            url=url,
            width=1920,
            height=1080,
            min_size=(1280, 720),
            fullscreen=True,
            confirm_close=True,
            text_select=True,
        )
        webview.start(gui="edgechromium", debug=False)
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
