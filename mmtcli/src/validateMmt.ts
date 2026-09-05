import fs from 'fs';
import path from 'path';
import * as mmtcore from 'mmt-core';

export function validateMmtFile(filePath: string, expectedType?: string): {
  valid: boolean;
  detectedType: string|null;
  errors: string[];
} {
  const content = fs.readFileSync(filePath, 'utf8');
  const detectedType = mmtcore.JSer.fileType(filePath, content);
  if (expectedType && detectedType && detectedType !== expectedType) {
    return {
      valid: false,
      detectedType,
      errors: [`Expected type "${expectedType}" but detected "${detectedType}"`],
    };
  }
  const type = expectedType || detectedType;
  try {
    if (type === 'api') {
      mmtcore.apiParsePack.yamlToAPIStrict(content);
    } else if (type === 'test' || !type) {
      mmtcore.testParsePack.yamlToTestStrict(content);
    } else {
      return {
        valid: false,
        detectedType,
        errors: [`Validation for type "${type}" is not implemented yet`],
      };
    }
    return {valid: true, detectedType: type || detectedType, errors: []};
  } catch (error: any) {
    const message = error?.message || String(error);
    return {
      valid: false,
      detectedType,
      errors: message.split('\n').filter(Boolean),
    };
  }
}

export function resolveValidatePath(file: string, cwd = process.cwd()): string {
  return path.isAbsolute(file) ? file : path.resolve(cwd, file);
}
