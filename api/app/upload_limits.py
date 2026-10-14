"""Bound request bytes before the multipart parser can spool unbounded data."""
from starlette.formparsers import MultiPartException
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

MAX_FILE_SIZE = 20 * 1024 * 1024
# Permit a full-size file plus bounded multipart headers and fields.
MAX_REQUEST_SIZE = MAX_FILE_SIZE + 1024 * 1024


class RequestSizeLimitMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        rejection = JSONResponse({"detail": "请求体超过 21MiB 限制（文件上限 20MiB）"}, status_code=413)
        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    declared_size = int(value)
                except ValueError:
                    await JSONResponse({"detail": "无效的 Content-Length"}, status_code=400)(scope, receive, send)
                    return
                if declared_size > MAX_REQUEST_SIZE:
                    await rejection(scope, receive, send)
                    return

        received = 0
        exceeded = False
        rejected = False

        async def limited_receive() -> Message:
            nonlocal received, exceeded
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > MAX_REQUEST_SIZE:
                    exceeded = True
                    # Starlette catches this exception and closes every partially
                    # spooled file. HTTPException would bypass that cleanup.
                    raise MultiPartException("Request body too large")
            return message

        async def limited_send(message: Message):
            nonlocal rejected
            if not exceeded:
                await send(message)
            elif not rejected:
                # The parser maps MultiPartException to 400. Keep its cleanup but
                # expose the size violation as 413, including chunked requests.
                rejected = True
                await rejection(scope, receive, send)

        try:
            await self.app(scope, limited_receive, limited_send)
        except MultiPartException:
            if not exceeded:
                raise
            if not rejected:
                await rejection(scope, receive, send)
