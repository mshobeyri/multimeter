import { notypeSamples, notypeStarterByType, notypeStarterContent } from "./notypeSamples";

describe("notypeStarterContent", () => {
  it("returns dedicated icon starters for each creatable type", () => {
    for (const type of Object.keys(notypeStarterByType) as Array<keyof typeof notypeStarterByType>) {
      expect(notypeStarterContent(type)).toBe(notypeStarterByType[type]);
      expect(notypeStarterContent(type)).toContain(`type: ${type}`);
    }
  });

  it("keeps icon starters simpler than gallery samples for api and test", () => {
    const apiGallery = notypeSamples.filter(sample => sample.type === "api").map(sample => sample.content);
    const testGallery = notypeSamples.filter(sample => sample.type === "test").map(sample => sample.content);

    expect(apiGallery).not.toContain(notypeStarterByType.api);
    expect(testGallery).not.toContain(notypeStarterByType.test);
    expect(notypeStarterByType.api).not.toContain("inputs:");
    expect(notypeStarterByType.test).not.toContain("tags:");
  });
});
