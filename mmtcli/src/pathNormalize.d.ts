import type path from 'path';

export function normalizeUserPath(input: string): string;
export function resolveUserPath(
    input: string, baseDir?: string, pathMod?: typeof path): string;
export function resolveUserPathPreferExisting(
    input: string, baseDirs: string|string[], pathMod?: typeof path,
    existsFn?: (p: string) => boolean): string;
export function writeTextFile(filePath: string, content: string): string;
