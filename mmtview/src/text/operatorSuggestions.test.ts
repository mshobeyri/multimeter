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

  it("includes the as-string equality operators", () => {
    const inline = buildOperatorSuggestions("inline");
    const typeUnsafe = inline.find(item => item.filterText === "=S");
    expect(typeUnsafe).toMatchObject({
      insertText: " =S ",
      detail: "Equal (as string)",
    });
    expect(typeUnsafe?.label).toContain("=S");
    expect(typeUnsafe?.documentation).toContain("as strings");

    const notEqual = inline.find(item => item.filterText === "!S");
    expect(notEqual).toMatchObject({ insertText: " !S " });
  });

  it("quotes operators for the object form and keeps fuzzy percent defaults", () => {
    const quoted = buildOperatorSuggestions("quoted");
    expect(quoted.find(item => item.filterText === "==")?.insertText).toBe(' "=="');
    expect(quoted.find(item => item.filterText === "=S")?.insertText).toBe(' "=S"');
    expect(quoted.find(item => item.filterText === ">%")?.insertText).toBe(' ">%"');

    const inline = buildOperatorSuggestions("inline");
    expect(inline.find(item => item.filterText === ">%")?.insertText).toBe(' ">80%" ');
    expect(inline.find(item => item.filterText === "<%")?.insertText).toBe(" <80% ");
    expect(quoted.find(item => item.filterText === "=s~")?.insertText).toBe(' "=s~"');
    expect(inline.find(item => item.filterText === "=s~")?.insertText).toBe(" =1s~ ");
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
