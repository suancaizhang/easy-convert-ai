import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { I18nProvider, getTranslation } from "@/lib/i18n";
import HistoryPage from "./page";
const session = { user: { id: "user" }, loading: false };
vi.mock("@/lib/auth", () => ({ useAuth: () => session }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());
it("shows a failed history load separately from empty history and can retry", async () => {
  vi.spyOn(api, "get").mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ items: [], total: 0 });
  render(<I18nProvider><HistoryPage /></I18nProvider>);
  const alert = await screen.findByRole("alert");
  expect(screen.queryByText(getTranslation("history.empty"))).not.toBeInTheDocument();
  fireEvent.click(within(alert).getByRole("button"));
  expect(await screen.findByText(getTranslation("history.empty"))).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("offers preview and download for every successful conversion type", async () => {
  const types = ["pdf_to_word", "word_to_pdf", "excel_to_pdf", "ppt_to_pdf", "pdf_to_image", "images_to_pdf", "ocr_to_word", "pdf_merge", "pdf_split", "pdf_compress", "pdf_rotate", "pdf_watermark"];
  vi.spyOn(api, "get").mockResolvedValue({ total: 12, items: types.map((task_type) => ({
    id: task_type, filename: task_type + ".pdf", task_type, task_id: task_type,
    task_status: "success", file_status: "active", file_size: 50, created_at: "2026-01-01T00:00:00Z",
  })) });
  render(<I18nProvider><HistoryPage /></I18nProvider>);
  await screen.findByText("pdf_watermark.pdf");
  expect(screen.getAllByRole("button", { name: getTranslation("history.preview"), exact: true })).toHaveLength(12);
  expect(screen.getAllByRole("button", { name: getTranslation("history.download"), exact: true })).toHaveLength(12);
});
