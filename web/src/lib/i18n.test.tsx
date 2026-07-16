import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  I18nProvider,
  isLocale,
  readStoredLocale,
  useI18n,
} from "@/lib/i18n";

function LocaleProbe() {
  const { locale, setLocale, t } = useI18n();
  return (
    <>
      <p>{locale}</p>
      <p>{t("nav.startConvert")}</p>
      <button onClick={() => setLocale("th")}>switch</button>
    </>
  );
}

describe("i18n", () => {
  it("accepts only the seven supported locale codes", () => {
    expect(isLocale("zh-CN")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("id")).toBe(true);
    expect(isLocale("vi")).toBe(true);
    expect(isLocale("th")).toBe(true);
    expect(isLocale("fil")).toBe(true);
    expect(isLocale("ms")).toBe(true);
    expect(isLocale("ph")).toBe(false);
    expect(isLocale("fr")).toBe(false);
  });

  it("falls back to the default locale for missing or invalid storage", () => {
    expect(readStoredLocale()).toBe(DEFAULT_LOCALE);
    localStorage.setItem("locale", "fr");
    expect(readStoredLocale()).toBe(DEFAULT_LOCALE);
  });

  it("restores, persists, and applies a locale to the document", async () => {
    localStorage.setItem("locale", "en");
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>
    );

    expect(screen.getByText("en")).toBeInTheDocument();
    expect(screen.getByText("Start converting")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");

    await user.click(screen.getByRole("button", { name: "switch" }));
    expect(screen.getByText("th")).toBeInTheDocument();
    expect(localStorage.getItem("locale")).toBe("th");
    expect(document.documentElement.lang).toBe("th");
  });
});
