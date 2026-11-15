import { describe, expect, it } from "vitest";
import { parseHomeLanguages, serializeHomeLanguages, toggleHomeLanguage } from "./homeLanguages";

describe("home languages", () => {
  it("reads known codes in the offered order", () => {
    expect(parseHomeLanguages("en, uz,xx,UZ")).toEqual(["uz", "en"]);
    expect(parseHomeLanguages("any")).toEqual([]);
    expect(parseHomeLanguages(undefined)).toEqual([]);
  });

  it("saves any when none is chosen", () => {
    expect(serializeHomeLanguages([])).toBe("any");
    expect(serializeHomeLanguages(["ru", "uz"])).toBe("uz,ru");
  });

  it("toggles a language on and off", () => {
    expect(toggleHomeLanguage("any", "uz")).toBe("uz");
    expect(toggleHomeLanguage("uz", "en")).toBe("uz,en");
    expect(toggleHomeLanguage("uz,en", "uz")).toBe("en");
    expect(toggleHomeLanguage("en", "en")).toBe("any");
  });
});
