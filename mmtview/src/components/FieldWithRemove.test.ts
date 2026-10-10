import { fieldTrailingLayout } from "./FieldWithRemove";

describe("fieldTrailingLayout", () => {
  it("reserves the actual button width and spacing", () => {
    expect(fieldTrailingLayout({ buttonCount: 1 })).toEqual({
      typeText: "",
      paddingRight: 36,
      typeRight: 36,
    });
  });

  it("places type labels after all trailing buttons and reserves label width", () => {
    expect(fieldTrailingLayout({ typeLabel: "number", buttonCount: 2 })).toEqual({
      typeText: "(number)",
      paddingRight: 108,
      typeRight: 68,
    });
  });

  it("keeps a small default inset when there are no trailing controls", () => {
    expect(fieldTrailingLayout({})).toEqual({
      typeText: "",
      paddingRight: 8,
      typeRight: 4,
    });
  });
});
