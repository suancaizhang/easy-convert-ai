import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";

class UploadTransport {
  static current: UploadTransport;
  status = 0;
  responseText = "";
  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;

  constructor() {
    UploadTransport.current = this;
  }

  open() {}
  setRequestHeader() {}
  send() {}

  respond(status: number, body: string) {
    this.status = status;
    this.responseText = body;
    this.onload?.();
  }
}

beforeEach(() => {
  vi.stubGlobal("XMLHttpRequest", UploadTransport);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JSON requests", () => {
  it("resolves a successful empty deletion as void", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(api.delete("/api/documents/document-id")).resolves.toBeUndefined();
  });

  it("preserves the HTTP status of a non-JSON error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<h1>Unavailable</h1>", { status: 503 })));
    await expect(api.get("/api/tasks/task-id/status")).rejects.toMatchObject({ status: 503 });
  });
});

describe("uploads", () => {
  const file = () => new File(["document"], "document.pdf", { type: "application/pdf" });

  it("reports progress and resolves the successful JSON response", async () => {
    const progress = vi.fn();
    const result = api.upload("/api/documents/upload", file(), progress);
    UploadTransport.current.upload.onprogress?.(new ProgressEvent("progress", {
      lengthComputable: true, loaded: 3, total: 4,
    }));
    UploadTransport.current.respond(201, '{"id":"document-id"}');
    expect(progress).toHaveBeenCalledWith(75);
    await expect(result).resolves.toEqual({ id: "document-id" });
  });

  it("rejects an HTML 413 rather than throwing from the load event and hanging", async () => {
    const result = api.upload("/api/documents/upload", file());
    const rejection = expect(result).rejects.toMatchObject({ status: 413 });
    UploadTransport.current.respond(413, "<html>Request Entity Too Large</html>");
    await rejection;
  });

  it("rejects malformed success JSON rather than leaving the upload pending", async () => {
    const result = api.upload("/api/documents/upload", file());
    const rejection = expect(result).rejects.toBeInstanceOf(ApiError);
    UploadTransport.current.respond(200, "not JSON");
    await rejection;
  });

  it("preserves a structured API rejection", async () => {
    const result = api.upload("/api/documents/upload", file());
    const rejection = expect(result).rejects.toMatchObject({ status: 400, message: "ERR_FILE_TYPE" });
    UploadTransport.current.respond(400, '{"detail":"ERR_FILE_TYPE"}');
    await rejection;
  });

  it("rejects JSON null errors with the HTTP status", async () => {
    const result = api.upload("/api/documents/upload", file());
    const rejection = expect(result).rejects.toMatchObject({ status: 502 });
    UploadTransport.current.respond(502, "null");
    await rejection;
  });

  it("resolves a 204 upload without parsing an absent body", async () => {
    const result = api.upload<void>("/api/documents/upload", file());
    UploadTransport.current.respond(204, "");
    await expect(result).resolves.toBeUndefined();
  });

  it.each(["onerror", "onabort", "ontimeout"] as const)("rejects on %s", async (event) => {
    const result = api.upload("/api/documents/upload", file());
    const rejection = expect(result).rejects.toMatchObject({ status: 0 });
    UploadTransport.current[event]?.();
    await rejection;
  });
});
