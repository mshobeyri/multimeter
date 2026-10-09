import { REQUEST_BODY_FORMAT_MENU } from "./BodyFormatControls";

describe("request body format menu", () => {
  it("maps Raw to plain storage and YAML-encoded formats to encoded storage", () => {
    const choices = REQUEST_BODY_FORMAT_MENU.filter(
      (entry): entry is Extract<typeof entry, { kind: "option" }> => entry.kind === "option",
    );
    const rawFormats = choices
      .filter(entry => entry.storageMode === "plain")
      .map(entry => entry.value);
    const formattedFormats = choices
      .filter(entry => entry.storageMode === "encoded")
      .map(entry => entry.value);
    const formattedLabels = choices
      .filter(entry => entry.storageMode === "encoded")
      .map(entry => entry.label);

    expect(rawFormats).toEqual(["json", "xml", "xmle", "text", "urlencoded"]);
    expect(formattedFormats).toEqual(["xml", "json", "xmle", "urlencoded"]);
    expect(formattedLabels).toEqual(["xml-yml", "json-yml", "xmle-yml", "urlencoded-yml"]);
    expect(REQUEST_BODY_FORMAT_MENU).toContainEqual({ kind: "heading", label: "YAML-encoded" });
  });
});
