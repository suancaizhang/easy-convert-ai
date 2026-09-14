import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { PreviewModal } from "./PreviewModal";

const matchMedia = () => ({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("mounts one preview and removes it when closed", () => {
  vi.stubGlobal("matchMedia", matchMedia);
  const onClose = vi.fn();
  const view = (open: boolean) => (
    <I18nProvider>
      <PreviewModal open={open} onClose={onClose}>
        <canvas aria-label="Document page" />
      </PreviewModal>
    </I18nProvider>
  );
  const { rerender } = render(view(true));
  expect(screen.getAllByLabelText("Document page")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button"));
  expect(onClose).toHaveBeenCalledOnce();
  rerender(view(false));
  expect(screen.queryByLabelText("Document page")).not.toBeInTheDocument();
});
