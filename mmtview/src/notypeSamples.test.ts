import { notypeSamples, notypeStarterContent } from "./notypeSamples";

describe("notypeStarterContent", () => {
  it("returns the first gallery sample for each creatable type", () => {
    for (const type of ["api", "test", "suite", "env", "loadtest", "doc", "server", "judge"] as const) {
      const expected = notypeSamples.find(sample => sample.type === type)?.content;
      expect(notypeStarterContent(type)).toBe(expected);
      expect(notypeStarterContent(type)).toContain(`type: ${type}`);
    }
  });

  it("includes more than just the type line for api and test", () => {
    expect(notypeStarterContent("api").split("\n").length).toBeGreaterThan(2);
    expect(notypeStarterContent("test").split("\n").length).toBeGreaterThan(2);
  });
});
