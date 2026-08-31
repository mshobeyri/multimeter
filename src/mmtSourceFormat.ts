import {detectImportSource, isSpecSourceKind} from 'mmt-core/importConvertor';
import {isBrunoCollectionFilePath, isBrunoFilePath} from 'mmt-core/brunoParsePack';

export type HostSourceFormat =
    'mmt'|'http'|'bruno'|'openapi'|'postman'|'wsdl';

export function isSpecFamilyPath(filePath: string): boolean {
  const lowerPath = String(filePath || '').toLowerCase();
  // Bruno collection manifests are JSON but open in the Bruno editor, not Spec.
  if (isBrunoCollectionFilePath(lowerPath)) {
    return false;
  }
  return lowerPath.endsWith('.json') || lowerPath.endsWith('.yaml') ||
      lowerPath.endsWith('.yml') || lowerPath.endsWith('.xml') ||
      lowerPath.endsWith('.wsdl');
}

export function resolveSourceFormat(
    rawFile: string, filePath: string): HostSourceFormat {
  const lowerPath = String(filePath || '').toLowerCase();
  if (lowerPath.endsWith('.http') || lowerPath.endsWith('.https')) {
    return 'http';
  }
  if (isBrunoFilePath(lowerPath) || isBrunoCollectionFilePath(lowerPath)) {
    return 'bruno';
  }
  const kind = detectImportSource(rawFile, filePath);
  if (isSpecSourceKind(kind)) {
    return kind;
  }
  return 'mmt';
}
