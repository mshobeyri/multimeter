import { createContext } from "react";

export interface FileContextValue {
  filePath?: string;
  fileName?: string;
}

export const FileContext = createContext<FileContextValue>({});
