import { selectBodyFormatStorage } from "./bodyFormatSelection";

describe("selectBodyFormatStorage", () => {
  it("keeps encoded JSON YAML when switching to encoded XML and updates editor text", () => {
    const body = { user: { name: "Ada" } };
    const selected = selectBodyFormatStorage({
      body,
      currentText: '{\n  "user": {\n    "name": "Ada"\n  }\n}',
      sourceFormat: "json",
      targetFormat: "xml",
      storageMode: "encoded",
    });

    expect(selected.body).toBe(body);
    expect(selected.encodingFailed).toBe(false);
    expect(selected.bodyChanged).toBe(false);
    expect(selected.editText).toContain("<user>");
    expect(selected.editText).toContain("<name>Ada</name>");
  });

  it("packs raw JSON using its source format before switching to encoded XML", () => {
    const selected = selectBodyFormatStorage({
      body: '{"user":{"name":"Ada"}}',
      currentText: '{"user":{"name":"Ada"}}',
      sourceFormat: "json",
      targetFormat: "xml",
      storageMode: "encoded",
    });

    expect(selected.body).toEqual({ user: { name: "Ada" } });
    expect(selected.encodingFailed).toBe(false);
    expect(selected.editText).toContain("<name>Ada</name>");
  });
});
