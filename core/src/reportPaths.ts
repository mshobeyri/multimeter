import {
  computeRelative,
  fileUriToPath,
  isAbsPath,
  isProjectRootImport,
} from './fileHelper';
import type { CollectedResults, TestRunResult } from './reportCollector';

/**
 * Rewrite an absolute path to `+/…` relative to the project root (folder with
 * `multimeter.mmt`). Paths already using `+/`, relative paths, and paths outside
 * the project root are left unchanged.
 */
export function toProjectRootPath(filePath: string, projectRoot?: string): string {
  const raw = String(filePath ?? '').trim();
  if (!raw) {
    return raw;
  }
  if (isProjectRootImport(raw)) {
    return raw;
  }
  if (!projectRoot) {
    return raw;
  }
  const abs = fileUriToPath(raw);
  if (!isAbsPath(abs)) {
    return raw;
  }
  const rel = computeRelative(projectRoot, abs);
  if (!rel || rel === abs || rel.startsWith('..') || isAbsPath(rel)) {
    return raw;
  }
  if (rel === '.') {
    return '+/';
  }
  return '+/' + rel.replace(/\\/g, '/');
}

function rewriteRun(run: TestRunResult, projectRoot: string): TestRunResult {
  if (!run.filePath) {
    return run;
  }
  const next = toProjectRootPath(run.filePath, projectRoot);
  if (next === run.filePath) {
    return run;
  }
  return {...run, filePath: next};
}

/** Clone collected results with `filePath` / `suitePath` rewritten to `+/…`. */
export function applyProjectRootPaths(
  results: CollectedResults,
  projectRoot?: string,
): CollectedResults {
  if (!projectRoot) {
    return results;
  }
  const testRuns = results.testRuns.map(r => rewriteRun(r, projectRoot));
  const suiteRun = results.suiteRun
    ? {
        ...results.suiteRun,
        suitePath: results.suiteRun.suitePath
          ? toProjectRootPath(results.suiteRun.suitePath, projectRoot)
          : results.suiteRun.suitePath,
        testRuns: Array.isArray(results.suiteRun.testRuns)
          ? results.suiteRun.testRuns.map(r => rewriteRun(r, projectRoot))
          : results.suiteRun.testRuns,
      }
    : undefined;
  return {...results, testRuns, suiteRun};
}
