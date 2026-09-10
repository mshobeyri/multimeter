import fs from 'fs';
import path from 'path';

import * as validateMmt from 'mmt-core/validateMmt';

export function validateMmtFile(filePath: string, expectedType?: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  return validateMmt.validateMmtContent(content, filePath, expectedType);
}

export function resolveValidatePath(file: string, cwd = process.cwd()): string {
  return path.isAbsolute(file) ? file : path.resolve(cwd, file);
}
