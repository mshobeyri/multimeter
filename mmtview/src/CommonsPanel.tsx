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
  const [fields, setFields] = useState<VariableField[]>([]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "10px" }}>
      <FieldEditorTable fields={fields} setFields={setFields} />
    </div>
  );
};

export default Commons;