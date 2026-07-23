import {fileType} from './JSer';
import {formatMmtYamlAst} from './mmtFormatAst';
import {generateMmtReport} from './mmtReport';
import {parseReportMmt} from './reportParser';
import YAML from 'yaml';

export type MmtDocType =
  'api' | 'test' | 'env' | 'suite' | 'doc' | 'server' | 'loadtest' | 'report' | 'csv' | null;

export function detectMmtDocType(content: string, filePath?: string): MmtDocType {
  if (filePath) {
    return fileType(filePath, content) as MmtDocType;
  }
  if (content.includes('type: api')) {
    return 'api';
  }
  if (content.includes('type: test')) {
    return 'test';
  }
  if (content.includes('type: env')) {
    return 'env';
  }
  if (content.includes('type: suite')) {
    return 'suite';
  }
  if (content.includes('type: doc')) {
    return 'doc';
  }
  if (content.includes('type: server')) {
    return 'server';
  }
  if (content.includes('type: loadtest')) {
    return 'loadtest';
  }
  if (content.includes('type: report')) {
    return 'report';
  }
  return null;
}

export function formatMmtYaml(content: string, filePath?: string): {
  formatted: string;
  docType: string;
  changed: boolean;
} {
  const docType = detectMmtDocType(content, filePath);
  if (!docType) {
    throw new Error('Unknown Multimeter document type. Expected a .mmt file with a supported type field.');
  }

  let formatted: string;
  switch (docType) {
    case 'api':
    case 'test':
    case 'env':
    case 'doc':
    case 'suite':
    case 'loadtest':
    case 'server':
      // AST path preserves `#` comments while reordering known keys.
      formatted = formatMmtYamlAst(content, docType);
      break;
    case 'report': {
      const parsed = YAML.parse(content);
      if (!parsed || parsed.type !== 'report') {
        throw new Error('Document is not a valid report YAML.');
      }
      const results = parseReportMmt(parsed);
      formatted = generateMmtReport(results, {suiteName: parsed.name});
      break;
    }
    default:
      throw new Error(`Formatting is not supported for type "${docType}" yet.`);
  }

  return {
    formatted,
    docType,
    changed: formatted.trim() !== content.trim(),
  };
}
