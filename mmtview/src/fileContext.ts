import { createContext } from "react";
import type { BrunoSourceFile } from "mmt-core/brunoParsePack";
import type { YamlEditorError } from "./text/yamlEditorErrors";

export interface FileContextValue {
  mmtFilePath?: string;
  projectRoot?: string;
  yamlErrors?: YamlEditorError[];
  yamlStale?: boolean;
  restoreValidYaml?: () => void;
  /** True after the user clicks Keep on the YAML error dim overlay. */
  yamlErrorDimDismissed?: boolean;
  dismissYamlErrorDim?: () => void;
  collectionFiles?: BrunoSourceFile[];
  collectionName?: string;
}

export const FileContext = createContext<FileContextValue>({});
