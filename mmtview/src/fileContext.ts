import { createContext } from "react";

export interface FileContextValue {
  mmtFilePath?: string;
  projectRoot?: string;
}

export const FileContext = createContext<FileContextValue>({});
