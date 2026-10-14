import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";
import { fetchTaskFile } from "./fetchTaskFile";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("formats validation locations and messages rather than object coercion", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: [
    { loc: ["body", "password"], msg: "String should have at least 8 characters" },
    { loc: ["body", "email"], msg: "Invalid email" },
  ] }), { status: 422 })));
  await expect(api.post("/api/auth/register", {})).rejects.toMatchObject({
    status: 422, message: "password: String should have at least 8 characters; email: Invalid email",
  });
});

it.each(["json", "blob"])("aborts a stalled %s request after 30 seconds", async (kind) => {
  vi.useFakeTimers();
  let aborted = false;
  vi.stubGlobal("fetch", vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener("abort", () => { aborted = true; reject(options.signal?.reason); });
  })));
  const request = kind === "json" ? api.get("/status") : fetchTaskFile("task");
  const failure = expect(request).rejects.toMatchObject({ status: 0 });
  await vi.advanceTimersByTimeAsync(30_000);
  expect(aborted).toBe(true);
  await failure;
});

it("keeps the timeout active while a response body is still streaming", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(async (_url, options: RequestInit) => ({
    ok: true, status: 200,
    json: () => new Promise((_resolve, reject) => options.signal?.addEventListener("abort", () => reject(options.signal?.reason))),
  })));
  const failure = expect(api.get("/status")).rejects.toMatchObject({ status: 0 });
  await vi.advanceTimersByTimeAsync(30_000);
  await failure;
});

it("times out a stalled upload instead of remaining pending indefinitely", async () => {
  vi.useFakeTimers();
  class XHR {
    timeout = 0;
    upload = {};
    ontimeout?: () => void;
    open() {}
    setRequestHeader() {}
    send() { if (this.timeout > 0) setTimeout(() => this.ontimeout?.(), this.timeout); }
  }
  vi.stubGlobal("XMLHttpRequest", XHR);
  let settled = false;
  const request = api.upload("/upload", new File(["pdf"], "a.pdf")).catch((error) => { settled = true; return error; });
  await vi.advanceTimersByTimeAsync(120_000);
  expect(settled).toBe(true);
  await expect(request).resolves.toMatchObject({ status: 0 });
});
