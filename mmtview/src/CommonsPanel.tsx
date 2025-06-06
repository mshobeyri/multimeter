import React, { useEffect, useState } from "react";
import parseYaml from "./yamlparser";
import ComboTable, { ComboTablePair } from "./components/ComboTable";
import FieldEditorTable from "./components/FieldEditorTable";
import { VariableField } from "./components/FieldEditorTable";


interface CommonsProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

const Commons: React.FC<CommonsProps> = ({ content, setContent }) => {
  const [fields, setFields] = useState<VariableField[]>([
    { key: "trace_id", name: "traceId", type: "string", info: "Trace Id is used to track a request." },
    { key: "session", name: "session", type: "integer", info: "Session informations." },
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "10px" }}>
      <FieldEditorTable fields={fields} setFields={setFields} />
    </div>
  );
};

export default Commons;