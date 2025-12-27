import { useEffect, useMemo, useRef, useState } from "react";
import { parseYamlDoc } from "mmt-core/markupConvertor";
import { offsetToLineNumber } from "./validator"; // Assuming offsetToLineNumber is available or can be imported

export type MissingDocFileEntry = { path: string; line: number; column: number; message: string };

function extractDocFilePaths(docType: string | null, content: string) {
  const fileEntries: { path: string; line: number; column: number; message: string }[] = [];
  if (docType !== "doc") {
    return fileEntries;
  }

  let parsed: any;
  try {
    parsed = parseYamlDoc(content);
  } catch {
    return fileEntries;
  }
  const root: any = parsed?.contents;
  const rootItems: any[] = Array.isArray(root?.items) ? root.items : [];

  // Extract logo path
  const logoPair = rootItems.find((item) => item?.key?.value === "logo");
  if (logoPair && logoPair.value && typeof logoPair.value.value === "string") {
    const path = logoPair.value.value.trim();
    if (path) {
      const offset =
        Array.isArray(logoPair.value?.range) && typeof logoPair.value.range[0] === "number"
          ? logoPair.value.range[0]
          : undefined;
      if (typeof offset === "number") {
        const line = offsetToLineNumber(content, offset);
        const pre = content.slice(0, offset);
        const lastNl = pre.lastIndexOf('\n');
        const column = lastNl >= 0 ? pre.length - lastNl : pre.length + 1;
        fileEntries.push({ path, line, column, message: `Logo file "${path}" not found.` });
      }
    }
  }

  // Extract root sources
  const sourcesPair = rootItems.find((item) => item?.key?.value === "sources");
  if (sourcesPair && sourcesPair.value && Array.isArray(sourcesPair.value.items)) {
    sourcesPair.value.items.forEach((sourceNode: any) => {
      if (sourceNode && typeof sourceNode.value === "string") {
        const path = sourceNode.value.trim();
        if (path) {
          const offset =
            Array.isArray(sourceNode?.range) && typeof sourceNode.range[0] === "number"
              ? sourceNode.range[0]
              : undefined;
          if (typeof offset === "number") {
            const line = offsetToLineNumber(content, offset);
            const pre = content.slice(0, offset);
            const lastNl = pre.lastIndexOf('\n');
            const column = lastNl >= 0 ? pre.length - lastNl : pre.length + 1;
            fileEntries.push({ path, line, column, message: `Source file/path "${path}" not found.` });
          }
        }
      }
    });
  }

  // Extract service sources
  const servicesPair = rootItems.find((item) => item?.key?.value === "services");
  if (servicesPair && servicesPair.value && Array.isArray(servicesPair.value.items)) {
    servicesPair.value.items.forEach((serviceNode: any) => {
      if (serviceNode && Array.isArray(serviceNode.items)) {
        const serviceSourcesPair = serviceNode.items.find((item: any) => item?.key?.value === "sources");
        if (serviceSourcesPair && serviceSourcesPair.value && Array.isArray(serviceSourcesPair.value.items)) {
          serviceSourcesPair.value.items.forEach((sourceNode: any) => {
            if (sourceNode && typeof sourceNode.value === "string") {
              const path = sourceNode.value.trim();
              if (path) {
                const offset =
                  Array.isArray(sourceNode?.range) && typeof sourceNode.range[0] === "number"
                    ? sourceNode.range[0]
                    : undefined;
                if (typeof offset === "number") {
                  const line = offsetToLineNumber(content, offset);
                  const pre = content.slice(0, offset);
                  const lastNl = pre.lastIndexOf('\n');
                  const column = lastNl >= 0 ? pre.length - lastNl : pre.length + 1;
                  fileEntries.push({ path, line, column, message: `Service source file/path "${path}" not found.` });
                }
              }
            }
          });
        }
      }
    });
  }

  return fileEntries;
}

export function useDocFileValidation(docType: string | null, content: string) {
  const docFileEntries = useMemo(
    () => extractDocFilePaths(docType, content),
    [docType, content]
  );
  const [missingDocFiles, setMissingDocFiles] = useState<MissingDocFileEntry[]>([]);
  const pendingIdRef = useRef<number>(0);

  useEffect(() => {
    if (docType !== "doc" || !window?.vscode || !docFileEntries.length) {
      setMissingDocFiles([]);
      return;
    }

    const requestId = Date.now();
    pendingIdRef.current = requestId;

    const filesToCheck = docFileEntries.map(entry => entry.path);

    const listener = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message !== "object") {
        return;
      }
      if (message.command !== "validateFilesExistResult") {
        return;
      }
      if (message.requestId && message.requestId !== pendingIdRef.current) {
        return;
      }

      const missingPaths = Array.isArray(message.missing) ? message.missing : [];
      const newMissingDocFiles: MissingDocFileEntry[] = [];
      docFileEntries.forEach(entry => {
        if (missingPaths.includes(entry.path)) {
          newMissingDocFiles.push(entry);
        }
      });
      setMissingDocFiles(newMissingDocFiles);
    };

    window.addEventListener("message", listener);
    window.vscode.postMessage({
      command: "validateFilesExist",
      requestId,
      files: filesToCheck,
    });

    return () => {
      window.removeEventListener("message", listener);
    };
  }, [docType, docFileEntries]);

  return { missingDocFiles };
}