import {yamlToAPIStrict} from './apiParsePack';
import {fileType} from './JSerHelper';
import {yamlToTestStrict} from './testParsePack';

export interface ValidateMmtResult {
  valid: boolean;
  detectedType: string|null;
  errors: string[];
}

export function validateMmtContent(
    content: string, filePath?: string,
    expectedType?: string): ValidateMmtResult {
  const detectedType = fileType(filePath || '', content);
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
      yamlToAPIStrict(content);
    } else if (type === 'test' || !type) {
      yamlToTestStrict(content);
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
