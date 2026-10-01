import {
  kvEntriesContentEqual,
  withTrailingEmptyRow,
  withoutTrailingEmptyKey,
} from "./kvEntryDraft";

describe("kv trailing empty key row", () => {
  it("treats a filled header and the same header plus a blank key as the same content", () => {
    const filled: [string, string][] = [["Accept", "application/json"]];
    const withBlank: [string, string][] = [["Accept", "application/json"], ["", ""]];
    expect(kvEntriesContentEqual(filled, withBlank)).toBe(true);
    expect(kvEntriesContentEqual(withBlank, filled)).toBe(true);
    expect(withoutTrailingEmptyKey(withBlank)).toEqual(filled);
  });

  it("adds a blank key row after a header value is filled in", () => {
    expect(withTrailingEmptyRow([["Accept", "application/json"]], true)).toEqual([
      ["Accept", "application/json"],
      ["", ""],
    ]);
  });

  it("does not add a second blank key row", () => {
    const rows: [string, string][] = [["Accept", "application/json"], ["", ""]];
    expect(withTrailingEmptyRow(rows, true)).toBe(rows);
  });

  it("leaves the list unchanged when another row is not allowed", () => {
    const rows: [string, string][] = [["Accept", "application/json"]];
    expect(withTrailingEmptyRow(rows, false)).toBe(rows);
  });

  it("starts an empty list with one blank key row", () => {
    expect(withTrailingEmptyRow([], true)).toEqual([["", ""]]);
  });
});
