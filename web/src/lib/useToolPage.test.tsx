import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "./api";
import { useToolPage } from "./useToolPage";

beforeEach(() => { vi.useFakeTimers(); vi.spyOn(api, "upload").mockResolvedValue({ id: "document" }); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const file = new File(["pdf"], "source.pdf");
it("cannot resurrect polling after unmount during a status request", async () => {
  let complete!: (value: unknown) => void;
  vi.spyOn(api, "get").mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  const { result, unmount } = renderHook(() => useToolPage({ createTask: async () => "task" }));
  await act(() => result.current.uploadAndRun([file]));
  await act(() => vi.advanceTimersByTimeAsync(2000));
  unmount();
  await act(async () => complete({ status: "waiting" }));
  expect(vi.getTimerCount()).toBe(0);
});
it("ignores an in-flight success after resetting to a new conversion", async () => {
  let complete!: (value: unknown) => void;
  vi.spyOn(api, "get").mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  const { result } = renderHook(() => useToolPage({ createTask: async () => "task" }));
  await act(() => result.current.uploadAndRun([file]));
  await act(() => vi.advanceTimersByTimeAsync(2000));
  act(() => result.current.reset());
  await act(async () => complete({ status: "success" }));
  expect(result.current.stage).toBe("idle");
  expect(result.current.taskId).toBe("");
});
it("invalidates in-flight polling when cancellation succeeds", async () => {
  let complete!: (value: unknown) => void;
  vi.spyOn(api, "get").mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  vi.spyOn(api, "post").mockResolvedValue({});
  const { result } = renderHook(() => useToolPage({ createTask: async () => "task" }));
  await act(() => result.current.uploadAndRun([file]));
  await act(() => vi.advanceTimersByTimeAsync(2000));
  await act(() => result.current.cancel());
  await act(async () => complete({ status: "processing", progress: 60 }));
  expect(result.current.stage).toBe("idle");
  expect(result.current.taskStatus).toBe("");
  expect(result.current.conversionProgress).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
it("does not begin polling when task creation finishes after reset", async () => {
  let complete!: (id: string) => void;
  const createTask = () => new Promise<string>((resolve) => { complete = resolve; });
  const { result } = renderHook(() => useToolPage({ createTask }));
  let pending!: Promise<void>;
  await act(async () => { pending = result.current.uploadAndRun([file]); });
  act(() => result.current.reset());
  await act(async () => { complete("old-task"); await pending; });
  expect(result.current.taskId).toBe("");
  expect(vi.getTimerCount()).toBe(0);
});
