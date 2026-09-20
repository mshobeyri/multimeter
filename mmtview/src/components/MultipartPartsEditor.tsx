import React, { useContext, useEffect, useRef, useState } from "react";
import { safeList } from "mmt-core/safer";
import type { MultipartPartSpec } from "mmt-core/multipartBody";
import FieldWithRemove from "./FieldWithRemove";
import FilePickerInput from "./FilePickerInput";
import { FileContext } from "../fileContext";
import {
  bodyToMultipartRows,
  isEmptyMultipartPartRow,
  multipartPartsSignature,
  multipartRowsToBody,
  withTrailingEmptyMultipartRows,
  type MultipartPartKind,
  type MultipartPartRow,
} from "./multipartPartsUi";

interface MultipartPartsEditorProps {
  value?: unknown;
  onChange: (parts: MultipartPartSpec[] | undefined) => void;
  disabled?: boolean;
}

const MultipartPartsEditor: React.FC<MultipartPartsEditorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const fileCtx = useContext(FileContext);
  const [rows, setRows] = useState<MultipartPartRow[]>(() => bodyToMultipartRows(value));
  const incomingSig = multipartPartsSignature(value);
  const prevSig = useRef(incomingSig);

  useEffect(() => {
    if (incomingSig !== prevSig.current) {
      prevSig.current = incomingSig;
      setRows(bodyToMultipartRows(value));
    }
  }, [incomingSig, value]);

  const commit = (next: MultipartPartRow[]) => {
    const withEmpty = withTrailingEmptyMultipartRows(next);
    const parts = multipartRowsToBody(withEmpty);
    prevSig.current = JSON.stringify(parts ?? null);
    setRows(withEmpty);
    onChange(parts);
  };

  const handleNameChange = (idx: number, name: string) => {
    commit(safeList(rows).map((row, i) => (i === idx ? { ...row, name } : row)));
  };

  const handleKindChange = (idx: number, kind: MultipartPartKind) => {
    commit(safeList(rows).map((row, i) => (i === idx ? { ...row, kind } : row)));
  };

  const handleValueChange = (idx: number, nextValue: string) => {
    commit(safeList(rows).map((row, i) => (i === idx ? { ...row, value: nextValue } : row)));
  };

  const handleRemove = (idx: number) => {
    commit(safeList(rows).filter((_, i) => i !== idx));
  };

  return (
    <div className="multipart-parts-editor">
      <table>
        <tbody>
          {safeList(rows).map((row, i) => {
            const trailingEmpty = i === rows.length - 1 && isEmptyMultipartPartRow(row);
            const removable = !disabled && !trailingEmpty;
            return (
              <tr key={i}>
                <td className="multipart-part-name">
                  <input
                    value={row.name}
                    onChange={e => handleNameChange(i, e.target.value)}
                    placeholder="name"
                    disabled={disabled}
                  />
                </td>
                <td className="multipart-part-kind">
                  <select
                    value={row.kind}
                    onChange={e => handleKindChange(i, e.target.value as MultipartPartKind)}
                    disabled={disabled}
                    aria-label="Part type"
                  >
                    <option value="text">Text</option>
                    <option value="file">File</option>
                  </select>
                </td>
                <td className="multipart-part-value">
                  {row.kind === "file" ? (
                    <FilePickerInput
                      value={row.value}
                      onChange={nextValue => handleValueChange(i, nextValue)}
                      onRemovePressed={() => handleRemove(i)}
                      basePath={fileCtx?.mmtFilePath}
                      showFilePicker={true}
                      removable={removable}
                      disabled={disabled}
                      placeholder="Relative path to file"
                    />
                  ) : (
                    <FieldWithRemove
                      value={row.value}
                      onChange={nextValue => handleValueChange(i, nextValue)}
                      onRemovePressed={() => handleRemove(i)}
                      placeholder="value"
                      disabled={disabled}
                      removable={removable}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default MultipartPartsEditor;
