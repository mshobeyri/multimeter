import { shouldUseCompactResponseControls } from "./responseBodyBarLayout";

describe("shouldUseCompactResponseControls", () => {
  it("keeps controls inline when the header has enough room", () => {
    expect(shouldUseCompactResponseControls(1600, 170)).toBe(false);
  });

  it("compacts controls when the header is constrained", () => {
    expect(shouldUseCompactResponseControls(600, 170)).toBe(true);
  });
});
