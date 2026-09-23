import {
  bodyToMultipartRows,
  emptyMultipartPartRow,
  multipartPartsSignature,
  multipartRowsToBody,
} from "./multipartPartsUi";

describe("multipartPartsUi", () => {
  it("maps text and file parts and keeps a trailing empty row", () => {
    expect(bodyToMultipartRows([
      { name: "description", value: "hello" },
      { name: "file", file: "./assets/sample.txt" },
    ])).toEqual([
      { name: "description", kind: "text", value: "hello" },
      { name: "file", kind: "file", value: "./assets/sample.txt" },
      emptyMultipartPartRow(),
    ]);
  });

  it("parses a JSON array string the way the old body editor stored multipart", () => {
    const json = JSON.stringify([
      { name: "meta", value: "hello" },
      { name: "file", file: "./upload.bin" },
    ], null, 2);
    expect(bodyToMultipartRows(json, false)).toEqual([
      { name: "meta", kind: "text", value: "hello" },
      { name: "file", kind: "file", value: "./upload.bin" },
    ]);
  });

  it("starts with a single empty row for missing or non-list bodies", () => {
    expect(bodyToMultipartRows(undefined)).toEqual([emptyMultipartPartRow()]);
    expect(bodyToMultipartRows({ name: "x", value: "y" })).toEqual([emptyMultipartPartRow()]);
    expect(bodyToMultipartRows("not-json")).toEqual([emptyMultipartPartRow()]);
  });

  it("round-trips complete parts including optional filename and contentType", () => {
    const body = [
      { name: "description", value: "hello from multipart" },
      {
        name: "file",
        file: "./assets/sample.txt",
        filename: "sample.txt",
        contentType: "text/plain",
      },
    ];
    expect(multipartRowsToBody(bodyToMultipartRows(body))).toEqual(body);
  });

  it("does not write the trailing empty row back to YAML", () => {
    expect(multipartRowsToBody(bodyToMultipartRows([
      { name: "a", value: "b" },
    ]))).toEqual([{ name: "a", value: "b" }]);
  });

  it("keeps named file parts even when the path is still empty", () => {
    expect(multipartRowsToBody([
      { name: "file", kind: "file", value: "" },
      emptyMultipartPartRow(),
    ])).toEqual([{ name: "file", file: "" }]);
  });

  it("treats a present file field as file kind even if value is also set", () => {
    expect(bodyToMultipartRows([
      { name: "upload", value: "ignored", file: "./a.bin" },
    ], false)).toEqual([
      { name: "upload", kind: "file", value: "./a.bin" },
    ]);
  });

  it("omits body when no named parts exist", () => {
    expect(multipartRowsToBody([emptyMultipartPartRow()])).toBeUndefined();
    expect(multipartRowsToBody([])).toBeUndefined();
  });

  it("keeps a stable signature across trailing-empty display rows", () => {
    const parts = [{ name: "a", value: "b" }];
    expect(multipartPartsSignature(parts))
      .toBe(multipartPartsSignature(bodyToMultipartRows(parts)));
  });
});
