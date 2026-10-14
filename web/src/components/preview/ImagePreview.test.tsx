import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ImagePreview } from "./ImagePreview";
import { fetchTaskFile } from "@/lib/fetchTaskFile";
import { I18nProvider, getTranslation } from "@/lib/i18n";
vi.mock("@/lib/fetchTaskFile", () => ({ fetchTaskFile: vi.fn() }));
beforeEach(() => vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:page"), revokeObjectURL: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
it("releases already-loaded pages when a later page fails", async () => {
  vi.mocked(fetchTaskFile).mockResolvedValueOnce({ total: 2, ext: ".png" }).mockResolvedValueOnce(new Blob(["png"])).mockRejectedValueOnce(new Error("offline"));
  render(<I18nProvider><ImagePreview taskId="images" /></I18nProvider>);
  await screen.findByText(getTranslation("preview.loadFailed"));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:page");
});
it("does not allocate a page URL after unmount during download", async () => {
  let complete!: (blob: Blob) => void;
  vi.mocked(fetchTaskFile).mockResolvedValueOnce({ total: 1, ext: ".png" }).mockImplementationOnce(() => new Promise<Blob>((resolve) => { complete = resolve; }));
  const { unmount } = render(<I18nProvider><ImagePreview taskId="images" /></I18nProvider>);
  await act(async () => {});
  unmount();
  await act(async () => complete(new Blob(["png"])));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
