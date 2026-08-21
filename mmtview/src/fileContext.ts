import { createContext } from "react";
import type { YamlEditorError } from "./text/yamlEditorErrors";

export interface FileContextValue {
  mmtFilePath?: string;
  projectRoot?: string;
  yamlErrors?: YamlEditorError[];
  yamlStale?: boolean;
  restoreValidYaml?: () => void;
}

export const FileContext = createContext<FileContextValue>({});
