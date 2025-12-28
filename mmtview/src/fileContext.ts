import { createContext } from "react";

export interface FileContextValue {
  mmtFilePath?: string;
}

export const FileContext = createContext<FileContextValue>({});
