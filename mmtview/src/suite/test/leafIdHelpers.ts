export function childSuiteLeafPrefix(leafId?: string): string | undefined {
    if (!leafId) {
        return undefined;
    }
    return `${leafId}/s`;
}
