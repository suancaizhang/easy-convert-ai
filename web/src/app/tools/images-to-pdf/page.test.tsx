import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ImagesToPdfPage from "./page";
import { I18nProvider } from "@/lib/i18n";

const liveUrls = new Set<string>();
let nextUrl = 0;
beforeEach(() => {
  nextUrl = 0;
  liveUrls.clear();
  vi.stubGlobal("URL", {
    createObjectURL: () => {
      const url = `blob:thumbnail-${++nextUrl}`;
      liveUrls.add(url);
      return url;
    },
    revokeObjectURL: (url: string) => liveUrls.delete(url),
  });
});
afterEach(() => vi.unstubAllGlobals());

it("keeps only retained thumbnails alive after the file limit, removal, and navigation", () => {
  const { container, unmount } = render(
    <StrictMode><I18nProvider><ImagesToPdfPage /></I18nProvider></StrictMode>
  );
  const files = Array.from({ length: 21 }, (_, index) => new File(["image"], `${index}.png`, { type: "image/png" }));
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files } });
  expect(screen.getByAltText("19.png")).toBeInTheDocument();
  expect(screen.queryByAltText("20.png")).not.toBeInTheDocument();
  expect(liveUrls).toEqual(new Set(screen.getAllByRole("img").map((image) => image.getAttribute("src"))));

  fireEvent.click(screen.getAllByRole("button", { name: "×" })[0]);
  expect(screen.queryByAltText("0.png")).not.toBeInTheDocument();
  expect(liveUrls).toEqual(new Set(screen.getAllByRole("img").map((image) => image.getAttribute("src"))));

  unmount();
  expect(liveUrls).toEqual(new Set());
});
