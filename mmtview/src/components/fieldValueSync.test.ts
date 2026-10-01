import { shouldAdoptFieldValue } from "./fieldValueSync";

describe("shouldAdoptFieldValue", () => {
  it("does not replace a field when the echoed value is the same", () => {
    expect(shouldAdoptFieldValue("hello", "hello", false)).toBe(false);
    expect(shouldAdoptFieldValue("hello", "hello", true)).toBe(false);
    expect(shouldAdoptFieldValue("", "", false)).toBe(false);
  });

  it("keeps the draft while the field is focused", () => {
    expect(shouldAdoptFieldValue("helXlo", "hello", true)).toBe(false);
    expect(shouldAdoptFieldValue("helXlo", "helXlo", true)).toBe(false);
  });

  it("adopts an external value when the field is not focused", () => {
    expect(shouldAdoptFieldValue("hello", "world", false)).toBe(true);
  });
});
