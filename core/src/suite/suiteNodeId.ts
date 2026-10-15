export interface SuiteNodeIdOptions {
  prefix?: string;
}

export function createSuiteNodeId(indexPath: readonly number[], options?: SuiteNodeIdOptions): string {
  const path = Array.isArray(indexPath) && indexPath.length > 0 ? indexPath.join('.') : '';
  const basePrefix = typeof options?.prefix === 'string' && options.prefix.trim().length > 0 ? options.prefix.trim() : 'suite-node';
  if (!path) {
    return basePrefix.includes(':') ? basePrefix : `${basePrefix}:root`;
  }
  if (basePrefix.includes(':')) {
    return `${basePrefix}.${path}`;
  }
  return `${basePrefix}:${path}`;
}
