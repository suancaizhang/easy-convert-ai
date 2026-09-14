"""云托管健康检查端点：processor 服务无对外 HTTP 业务，仍需监听端口通过探活。"""
import argparse
import http.server
import socketserver


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802（http.server 协议方法名）
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *_args):  # 静默，避免日志噪音
        pass


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    with socketserver.TCPServer(("0.0.0.0", args.port), Handler) as httpd:
        httpd.serve_forever()


if __name__ == "__main__":
    main()