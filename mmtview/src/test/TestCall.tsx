import React, { useContext, useEffect, useState } from "react";
import { Parameter } from "./TestData";

interface TestCallProps {
  value: string;
  imports?: Parameter[];
  onChange: (value: string) => void;
  placeholder?: string;
}

const TestCall: React.FC<TestCallProps> = ({
  value,
  imports,
  onChange,
  placeholder = "Select an item...",
}) => {

  const [filePath, setFilePath] = useState<string | undefined>(undefined);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    window.vscode?.postMessage({ command: "getFileContent", filename: selectedValue });
  }

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "fileContent") {
        console.log("filecn", message.content);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [filePath]);

  return (
    <select
      value={value}
      onChange={handleChange}
      style={{ width: "100%", padding: "6px" }}
    >
      <option value="">{placeholder}</option>
      {imports &&
        imports.map((imp: Parameter, idx) => {
          const key = Object.keys(imp)[0];
          const val = Object.values(imp)[0];
          return (
            <option key={key} value={val}>
              {key}
            </option>
          );
        })}
    </select>
  );
};

export default TestCall;