import { describe, expect, it } from "@jest/globals";
import { selectableOpsList } from "mmt-core/TestData";
import { buildOperatorSuggestions, operatorListText } from "./operatorSuggestions";

describe("operator autocomplete suggestions", () => {
  it("offers every selectable operator in both modes", () => {
    for (const mode of ["quoted", "inline"] as const) {
      const offered = buildOperatorSuggestions(mode).map(item => item.filterText);
      expect(offered).toEqual([...selectableOpsList]);
    }
  });

  it("includes the type-unsafe equality operators", () => {
    const inline = buildOperatorSuggestions("inline");
    const typeUnsafe = inline.find(item => item.filterText === "=~");
    expect(typeUnsafe).toMatchObject({
      insertText: " =~ ",
      detail: "Equal (type-unsafe)",
    });
    expect(typeUnsafe?.label).toContain("=~");
    expect(typeUnsafe?.documentation).toContain("as strings");

    const notEqual = inline.find(item => item.filterText === "!~");
    expect(notEqual).toMatchObject({ insertText: " !~ " });
  });

  it("quotes operators for the object form and keeps fuzzy percent defaults", () => {
    const quoted = buildOperatorSuggestions("quoted");
    expect(quoted.find(item => item.filterText === "==")?.insertText).toBe(' "=="');
    expect(quoted.find(item => item.filterText === "=~")?.insertText).toBe(' "=~"');
    expect(quoted.find(item => item.filterText === ">%")?.insertText).toBe(' ">%"');

    const inline = buildOperatorSuggestions("inline");
    expect(inline.find(item => item.filterText === ">%")?.insertText).toBe(' ">80%" ');
    expect(inline.find(item => item.filterText === "<%")?.insertText).toBe(" <80% ");
  });

  it("keeps the core operator order via sortText", () => {
    const sortTexts = buildOperatorSuggestions("inline").map(item => item.sortText);
    expect(sortTexts).toEqual([...sortTexts].sort());
  });

  it("lists every operator in the check/assert documentation text", () => {
    const text = operatorListText();
    for (const op of selectableOpsList) {
      expect(text).toContain(op);
    }
  });
});
