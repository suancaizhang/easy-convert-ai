import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth";
import { api, ApiError } from "./api";

function Session() {
  const { user, loading, logout } = useAuth();
  return <><span>{loading ? "loading" : user?.id || "anonymous"}</span><button onClick={logout}>Logout</button></>;
}
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
it.each([new ApiError("Unavailable", 503), new TypeError("Network offline")])("retains credentials on transient auth failure", async (error) => {
  localStorage.setItem("token", "session");
  vi.spyOn(api, "get").mockRejectedValue(error);
  render(<AuthProvider><Session /></AuthProvider>);
  await screen.findByText("anonymous");
  expect(localStorage.getItem("token")).toBe("session");
});
it("clears credentials only on an explicit unauthorized response", async () => {
  localStorage.setItem("token", "session");
  vi.spyOn(api, "get").mockRejectedValue(new ApiError("Unauthorized", 401));
  render(<AuthProvider><Session /></AuthProvider>);
  await waitFor(() => expect(localStorage.getItem("token")).toBeNull());
});
it("does not restore a logged-out user from an in-flight auth request", async () => {
  localStorage.setItem("token", "session");
  let complete!: (user: unknown) => void;
  vi.spyOn(api, "get").mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  render(<AuthProvider><Session /></AuthProvider>);
  act(() => screen.getByText("Logout").click());
  await act(async () => complete({ id: "old-user" }));
  expect(screen.queryByText("old-user")).not.toBeInTheDocument();
});
