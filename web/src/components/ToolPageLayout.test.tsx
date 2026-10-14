import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ToolPageLayout } from "./ToolPageLayout";
import { I18nProvider } from "@/lib/i18n";

it("keeps download errors visible without hiding the completed result actions", () => {
  render(<I18nProvider><ToolPageLayout title="Result" stage="done" uploadProgress={100} taskStatus="success"
    error="Download unavailable" taskId="task" onDownload={() => {}} onReset={() => {}} downloadLabel="Download again">
    <span>Upload</span>
  </ToolPageLayout></I18nProvider>);
  expect(screen.getByRole("alert")).toHaveTextContent("Download unavailable");
  expect(screen.getByRole("button", { name: "Download again" })).toBeEnabled();
});
