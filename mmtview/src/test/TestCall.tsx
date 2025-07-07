import React from "react";
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
  // Handler to print the selected value as a relative file path
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    // Print the value as a relative file path
    console.log("Selected relative file path:", selectedValue);
    onChange(selectedValue);
  };

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