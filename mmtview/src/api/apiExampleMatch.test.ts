import { ExampleData } from "mmt-core/APIData";
import { findMatchingExampleIndex, inputsEqual } from "./apiExampleMatch";

describe("inputsEqual", () => {
  it("treats missing and empty objects as equal", () => {
    expect(inputsEqual(undefined, {})).toBe(true);
    expect(inputsEqual(null, {})).toBe(true);
  });

  it("ignores key order", () => {
    expect(inputsEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("detects value differences", () => {
    expect(inputsEqual({ a: 1 }, { a: "1" })).toBe(false);
    expect(inputsEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe("findMatchingExampleIndex", () => {
  const examples: ExampleData[] = [
    { name: "one", inputs: { user: "a" } },
    { name: "two", inputs: { user: "b", n: 2 } },
    { name: "empty", inputs: {} },
  ];

  it("returns matching example index", () => {
    expect(findMatchingExampleIndex(examples, { user: "b", n: 2 })).toBe(1);
    expect(findMatchingExampleIndex(examples, { user: "a" })).toBe(0);
  });

  it("returns -1 when nothing matches (Select...)", () => {
    expect(findMatchingExampleIndex(examples, { user: "z" })).toBe(-1);
    expect(findMatchingExampleIndex(examples, { user: "a", extra: true })).toBe(-1);
  });

  it("matches empty inputs to an empty example", () => {
    expect(findMatchingExampleIndex(examples, {})).toBe(2);
  });

  it("returns -1 for empty example list", () => {
    expect(findMatchingExampleIndex([], { user: "a" })).toBe(-1);
    expect(findMatchingExampleIndex(undefined, { user: "a" })).toBe(-1);
  });
});
