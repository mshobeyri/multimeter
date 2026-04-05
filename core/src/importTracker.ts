export type ImportAliasMap = Record<string, string>;

export interface ImportTrackerSnapshot {
  visited: string[];
  importPathByResolvedPath: Record<string, string[]>;
  aliasByImportingResolvedPath: Record<string, ImportAliasMap>;
  testFuncNameByResolvedPath: Record<string, string>;
}

/**
 * Tracks which resolved file paths have been imported to prevent re-emission,
 * and records per-file nested import chains so callers can build alias maps.
 */
export class ImportTracker {
  private visitedPaths = new Set<string>();
  private importPathByResolvedPath = new Map<string, string[]>();
  private aliasByImportingResolvedPath = new Map<string, ImportAliasMap>();
  private testFuncNameByResolvedPath = new Map<string, string>();
  private fileTitleByResolvedPath = new Map<string, string>();
  private inputKeysByResolvedPath = new Map<string, string[]>();

  wasVisited(resolvedPath: string): boolean {
    return this.visitedPaths.has(resolvedPath);
  }

  markVisited(resolvedPath: string): void {
    this.visitedPaths.add(resolvedPath);
  }

  /**
   * Declares that `resolvedPath` is reached via `importPath`.
   * First claim wins to keep the graph deterministic.
   */
  recordImportPath(resolvedPath: string, importPath: string[]): void {
    if (!this.importPathByResolvedPath.has(resolvedPath)) {
      this.importPathByResolvedPath.set(resolvedPath, [...importPath]);
    }
  }

  getImportPath(resolvedPath: string): string[]|undefined {
    return this.importPathByResolvedPath.get(resolvedPath);
  }

  /**
   * Stores the computed imports alias object for an importing file.
   * Example: for `/root/main.mmt` => { m: "my_file" }
   */
  setAliasesForImporter(importingResolvedPath: string, aliases: ImportAliasMap): void {
    this.aliasByImportingResolvedPath.set(importingResolvedPath, {...aliases});
  }

  getAliasesForImporter(importingResolvedPath: string): ImportAliasMap {
    return this.aliasByImportingResolvedPath.get(importingResolvedPath) || {};
  }

  setTestFuncName(resolvedPath: string, funcName: string): void {
    if (!this.testFuncNameByResolvedPath.has(resolvedPath)) {
      this.testFuncNameByResolvedPath.set(resolvedPath, funcName);
    }
  }

  getTestFuncName(resolvedPath: string): string|undefined {
    return this.testFuncNameByResolvedPath.get(resolvedPath);
  }

  setFileTitle(resolvedPath: string, title: string): void {
    if (!this.fileTitleByResolvedPath.has(resolvedPath)) {
      this.fileTitleByResolvedPath.set(resolvedPath, title);
    }
  }

  getFileTitle(resolvedPath: string): string|undefined {
    return this.fileTitleByResolvedPath.get(resolvedPath);
  }

  setInputKeys(resolvedPath: string, keys: string[]): void {
    if (!this.inputKeysByResolvedPath.has(resolvedPath)) {
      this.inputKeysByResolvedPath.set(resolvedPath, [...keys]);
    }
  }

  getInputKeys(resolvedPath: string): string[]|undefined {
    return this.inputKeysByResolvedPath.get(resolvedPath);
  }

  snapshot(): ImportTrackerSnapshot {
    const importPathByResolvedPath: Record<string, string[]> = {};
    for (const [k, v] of this.importPathByResolvedPath.entries()) {
      importPathByResolvedPath[k] = [...v];
    }

    const aliasByImportingResolvedPath: Record<string, ImportAliasMap> = {};
    for (const [k, v] of this.aliasByImportingResolvedPath.entries()) {
      aliasByImportingResolvedPath[k] = {...v};
    }

    const testFuncNameByResolvedPath: Record<string, string> = {};
    for (const [k, v] of this.testFuncNameByResolvedPath.entries()) {
      testFuncNameByResolvedPath[k] = v;
    }

    return {
      visited: [...this.visitedPaths.values()],
      importPathByResolvedPath,
      aliasByImportingResolvedPath,
      testFuncNameByResolvedPath,
    };
  }
}
