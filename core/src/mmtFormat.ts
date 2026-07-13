import {fileType} from './JSer';
import {apiToYaml, yamlToAPI} from './apiParsePack';
import {docToYaml, yamlToDoc} from './docParsePack';
import {envToYaml, yamlToEnv} from './envParsePack';
import {loadtestToYaml, yamlToLoadTest} from './loadtestParsePack';
import {mockToYaml, yamlToMock} from './mockParsePack';
import {generateMmtReport} from './mmtReport';
import {parseReportMmt} from './reportParser';
import {suiteToYaml, yamlToSuite} from './suiteParsePack';
import {testToYaml, yamlToTest} from './testParsePack';
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
      formatted = apiToYaml(yamlToAPI(content));
      break;
    case 'test':
      formatted = testToYaml(yamlToTest(content));
      break;
    case 'env':
      formatted = envToYaml(yamlToEnv(content));
      break;
    case 'doc':
      formatted = docToYaml(yamlToDoc(content));
      break;
    case 'suite':
      formatted = suiteToYaml(yamlToSuite(content));
      break;
    case 'loadtest':
      formatted = loadtestToYaml(yamlToLoadTest(content));
      break;
    case 'server': {
      const mockData = yamlToMock(content);
      if (!mockData) {
        throw new Error('Document is not a valid server YAML.');
      }
      formatted = mockToYaml(mockData);
      break;
    }
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
