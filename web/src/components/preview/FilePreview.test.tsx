import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FilePreview } from "./FilePreview";
import { fetchTaskFile } from "@/lib/fetchTaskFile";
import { I18nProvider } from "@/lib/i18n";
vi.mock("@/lib/fetchTaskFile", () => ({ fetchTaskFile: vi.fn() }));
vi.mock("next/dynamic", () => ({ default: () => ({ file }: { file: string }) => <iframe title="PDF document" src={file} /> }));
vi.mock("./DocxPreview", () => ({ DocxPreview: () => <div>Word document</div> }));
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:document"), revokeObjectURL: vi.fn() });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
const view = (open = true) => <I18nProvider><FilePreview taskId="ocr" taskType="ocr_to_word" open={open} onClose={() => {}} /></I18nProvider>;
it("renders OCR text using actual artifact metadata, not the task type", async () => {
  vi.mocked(fetchTaskFile).mockImplementation(async (_id, options) => options?.json
    ? { total: 1, ext: ".txt" } : ({ text: async () => "Recognized plain text" } as Blob));
  render(view());
  expect(await screen.findByText("Recognized plain text")).toBeInTheDocument();
  expect(screen.queryByText("Word document")).not.toBeInTheDocument();
});
it("renders searchable OCR PDF and releases its URL on close", async () => {
  vi.mocked(fetchTaskFile).mockImplementation(async (_id, options) => options?.json
    ? { total: 1, ext: ".pdf" } : new Blob(["pdf"]));
  const { rerender } = render(view());
  expect(await screen.findByTitle("PDF document")).toHaveAttribute("src", "blob:document");
  rerender(view(false));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:document");
});
it("does not allocate a URL when an in-flight preview completes after closing", async () => {
  let complete!: (blob: Blob) => void;
  vi.mocked(fetchTaskFile).mockImplementation(async (_id, options) => options?.json
    ? { total: 1, ext: ".pdf" } : new Promise<Blob>((resolve) => { complete = resolve; }));
  const { rerender } = render(view());
  await waitFor(() => expect(complete).toBeDefined());
  rerender(view(false));
  await act(async () => complete(new Blob(["pdf"])));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
