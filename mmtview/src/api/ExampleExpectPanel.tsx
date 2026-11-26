import React, { useMemo } from "react";
import type { ExpectMap } from "mmt-core/data/TestData";
import type { JSONRecord } from "mmt-core/data/CommonData";
import {
  exampleExpectBodyToText,
  parseExampleExpectView,
} from "mmt-core/api-edit/exampleExpectView";
import KSVEditor from "../components/KSVEditor";

export type ExampleExpectPanelProps = {
  expect: ExpectMap | undefined;
};

function countNamedEntries(record?: Record<string, unknown> | null): number {
  if (!record || typeof record !== "object") {
    return 0;
  }
  return Object.keys(record).filter(key => String(key).trim().length > 0).length;
}

const ExampleExpectPanel: React.FC<ExampleExpectPanelProps> = ({ expect }) => {
  const view = useMemo(() => parseExampleExpectView(expect), [expect]);
  const headers = (view.headers || {}) as JSONRecord;
  const bodyText = useMemo(() => exampleExpectBodyToText(view.body), [view.body]);
  const hasHeaders = countNamedEntries(headers) > 0;
  const hasBody = bodyText.trim().length > 0;
  const hasAnything = view.status !== undefined || hasHeaders || hasBody ||
      Object.keys(view.other).length > 0;

  if (!hasAnything) {
    return <div className="apitest-empty">No expected response.</div>;
  }

  return (
    <div className="apitest-example-expect">
      <div className="label">Headers</div>
      {hasHeaders ? (
        <KSVEditor
          label=""
          value={headers}
          onChange={() => { }}
          deactivated={true}
        />
      ) : (
        <div className="apitest-empty">No expected headers.</div>
      )}

      <div className="label">Body</div>
      {hasBody ? (
        <pre className="apitest-example-expect-body">{bodyText}</pre>
      ) : (
        <div className="apitest-empty">No expected body.</div>
      )}
    </div>
  );
};

export default ExampleExpectPanel;
