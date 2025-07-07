import * as path from "path";

export async function readFileContent(filename: string): Promise<string> {
  const fs = await import("fs/promises");
  return fs.readFile(filename, "utf-8");
}

export async function readRelativeFileContent(openFilePath: string, relativePath: string): Promise<string> {
  const absolutePath = path.resolve(path.dirname(openFilePath), relativePath);
  return readFileContent(absolutePath);
}