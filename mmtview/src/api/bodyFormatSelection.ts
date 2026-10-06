import { Format } from "mmt-core/CommonData";
import {
  packBodyAsYamlEncoded,
  tokensTextToYamlBody,
  yamlBodyToTokensText,
  type RuntimeTokenValueContext,
} from "mmt-core/apiBodyEdit";

function isStructuredBody(body: unknown): body is object {
  return body !== null && typeof body === "object";
}

export function selectBodyFormatStorage(args: {
  body: unknown;
  currentText: string;
  sourceFormat: Format;
  targetFormat: Format;
  storageMode: "plain" | "encoded";
  valueContext?: RuntimeTokenValueContext;
  resolvedHint?: unknown;
}): {
  body: unknown;
  editText: string;
  encodingFailed: boolean;
  bodyChanged: boolean;
} {
  const sourceBody = isStructuredBody(args.body)
    ? args.body
    : packBodyAsYamlEncoded(args.currentText, args.sourceFormat);

  if (args.storageMode === "encoded") {
    if (!isStructuredBody(sourceBody)) {
      return {
        body: args.body,
        editText: args.currentText,
        encodingFailed: true,
        bodyChanged: false,
      };
    }
    return {
      body: sourceBody,
      editText: yamlBodyToTokensText(
        sourceBody,
        args.targetFormat,
        args.valueContext,
        args.resolvedHint,
      ),
      encodingFailed: false,
      bodyChanged: sourceBody !== args.body,
    };
  }

  const editText = isStructuredBody(sourceBody)
    ? yamlBodyToTokensText(
      sourceBody,
      args.targetFormat,
      args.valueContext,
      args.resolvedHint,
    )
    : args.currentText;

  return {
    body: tokensTextToYamlBody(editText, args.targetFormat, false),
    editText,
    encodingFailed: false,
    bodyChanged: true,
  };
}
