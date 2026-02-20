export type MissingImportEntry = { alias: string; path: string };

export type ProblemEntry = {
  message: string;
  severity: "error" | "warning";
  line?: number;
  column?: number;
  inputKey?: string;
  alias?: string;
};

export type OrderingIssue = {
  line: number;
  key: string;
  prevKey?: string;
  message: string;
};

type RootKeyInfo = {
  key: string;
  line: number;
};

type ImportLineInfo = {
  alias: string;
  path?: string;
  line: number;
};

export type CallSiteInfo = {
  alias: string;
  line: number;
};

export type CallInputKeyInfo = {
  alias: string;
  inputKey: string;
  line: number;
  offset: number;
};

export function offsetToLineNumber(content: string, offset: number): number {
  if (offset <= 0) {
    return 1;
  }
  let line = 1;
  const limit = Math.min(offset, content.length);
  for (let i = 0; i < limit; i++) {
    if (content.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

export function extractRootKeyInfo(doc: any, content: string): RootKeyInfo[] {
  const items: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  return items
    .map((item) => {
      const key = item?.key?.value;
      if (typeof key !== "string" || !key.trim()) {
        return null;
      }
      const offset = Array.isArray(item?.key?.range)
        ? item.key.range[0]
        : Array.isArray(item?.range)
          ? item.range[0]
          : undefined;
      const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
      return { key, line } as RootKeyInfo;
    })
    .filter(Boolean) as RootKeyInfo[];
}

export function extractImportLineInfo(doc: any, content: string): ImportLineInfo[] {
  const items: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const importPair = items.find((entry) => {
    const key = entry?.key?.value;
    return key === "import" || key === "imports";
  });
  if (!importPair || !importPair.value) {
    return [];
  }
  const mapItems: any[] = Array.isArray(importPair.value.items) ? importPair.value.items : [];
  return mapItems
    .map((pair) => {
      const alias = typeof pair?.key?.value === "string" ? pair.key.value : undefined;
      if (!alias) {
        return null;
      }
      const path = typeof pair?.value?.value === "string" ? pair.value.value : undefined;
      const offset =
        Array.isArray(pair?.value?.range) && typeof pair.value.range[0] === "number"
          ? pair.value.range[0]
          : Array.isArray(pair?.range)
            ? pair.range[0]
            : undefined;
      const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
      return { alias, path, line } as ImportLineInfo;
    })
    .filter(Boolean) as ImportLineInfo[];
}

export function getCanonicalOrder(docType: string | null): string[] | null {
  switch (docType) {
    case "api":
      return [
        "type",
        "title",
        "description",
        "tags",
        "import",
        "inputs",
        "outputs",
        "setenv",
        "url",
        "query",
        "protocol",
        "method",
        "format",
        "headers",
        "cookies",
        "body",
        "examples",
      ];
    case "test":
      return [
        "type",
        "title",
        "description",
        "tags",
        "import",
        "inputs",
        "outputs",
        "metrics",
        "steps",
        "stages",
      ];
    case "suite":
      return [
        "type",
        "title",
        "description",
        "tags",
        "tests",
      ];
    case "doc":
      return ["type", "title", "description", "logo", "sources", "services", "html", "env"];
    default:
      return null;
  }
}

export function detectOrderingIssue(doc: any, content: string, expectedOrder: string[]): OrderingIssue | null {
  const orderMap = new Map<string, number>();
  expectedOrder.forEach((key, idx) => orderMap.set(key, idx));
  const keys = extractRootKeyInfo(doc, content);
  let lastIdx = -1;
  let lastKey: string | undefined;
  for (const entry of keys) {
    if (!orderMap.has(entry.key)) {
      continue;
    }
    const currentIdx = orderMap.get(entry.key) ?? 0;
    if (currentIdx < lastIdx) {
      const message = lastKey
        ? `'${entry.key}' should appear before '${lastKey}' to follow the canonical order. Use Format Document (Shift+Alt+F) to fix it.`
        : `'${entry.key}' is out of order. Use Format Document (Shift+Alt+F) to fix it.`;
      return { line: entry.line, key: entry.key, prevKey: lastKey, message };
    }
    lastIdx = currentIdx;
    lastKey = entry.key;
  }
  return null;
}

function collectCallSitesFromSteps(seqItems: any[], content: string, results: CallSiteInfo[]): void {
  for (const stepNode of seqItems) {
    const stepPairs: any[] = Array.isArray(stepNode?.items) ? stepNode.items : [];
    const callPair = stepPairs.find((pair) => pair?.key?.value === "call");
    const alias = callPair?.value?.value;
    if (typeof alias === "string" && alias.trim()) {
      const offset =
        Array.isArray(callPair?.value?.range) && typeof callPair.value.range[0] === "number"
          ? callPair.value.range[0]
          : Array.isArray(callPair?.range)
            ? callPair.range[0]
            : undefined;
      const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
      results.push({ alias, line });
    }
    // Recurse into nested steps (repeat, for, if, etc.)
    const nestedStepsPair = stepPairs.find((pair) => pair?.key?.value === "steps");
    const nestedSeq: any[] = Array.isArray(nestedStepsPair?.value?.items) ? nestedStepsPair.value.items : [];
    if (nestedSeq.length) {
      collectCallSitesFromSteps(nestedSeq, content, results);
    }
  }
}

function extractTestCallSites(doc: any, content: string): CallSiteInfo[] {
  if (!doc?.contents?.items) {
    return [];
  }

  const rootItems: any[] = Array.isArray(doc.contents.items) ? doc.contents.items : [];
  const stepsPair = rootItems.find((item) => item?.key?.value === "steps");
  if (!stepsPair?.value?.items) {
    return [];
  }

  const callSites: CallSiteInfo[] = [];
  collectCallSitesFromSteps(stepsPair.value.items, content, callSites);
  return callSites;
}

function collectCallInputKeySitesFromSteps(seqItems: any[], content: string, results: CallInputKeyInfo[]): void {
  for (const stepNode of seqItems) {
    const stepPairs: any[] = Array.isArray(stepNode?.items) ? stepNode.items : [];
    const callPair = stepPairs.find((pair) => pair?.key?.value === "call");
    const alias = callPair?.value?.value;
    if (typeof alias === "string" && alias.trim()) {
      const inputsPair = stepPairs.find((pair) => pair?.key?.value === "inputs");
      const inputPairs: any[] = Array.isArray(inputsPair?.value?.items) ? inputsPair.value.items : [];

      for (const pair of inputPairs) {
        const inputKey = pair?.key?.value;
        if (typeof inputKey !== "string" || !inputKey.trim()) {
          continue;
        }
        const offset =
          Array.isArray(pair?.key?.range) && typeof pair.key.range[0] === "number"
            ? pair.key.range[0]
            : Array.isArray(pair?.range)
              ? pair.range[0]
              : undefined;
        const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
        results.push({ alias, inputKey, line, offset: typeof offset === "number" ? offset : -1 });
      }
    }
    // Recurse into nested steps (repeat, for, if, etc.)
    const nestedStepsPair = stepPairs.find((pair) => pair?.key?.value === "steps");
    const nestedSeq: any[] = Array.isArray(nestedStepsPair?.value?.items) ? nestedStepsPair.value.items : [];
    if (nestedSeq.length) {
      collectCallInputKeySitesFromSteps(nestedSeq, content, results);
    }
  }
}

export function extractTestCallInputKeySites(doc: any, content: string): CallInputKeyInfo[] {
  if (!doc?.contents?.items) {
    return [];
  }

  const rootItems: any[] = Array.isArray(doc.contents.items) ? doc.contents.items : [];
  const stepsPair = rootItems.find((item) => item?.key?.value === "steps");
  if (!stepsPair?.value?.items) {
    return [];
  }

  const infos: CallInputKeyInfo[] = [];
  collectCallInputKeySitesFromSteps(stepsPair.value.items, content, infos);
  return infos;
}

export function computeMissingImportMarkers(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  missingImports: MissingImportEntry[]
): { markers: any[]; problems: ProblemEntry[] } {
  if (!model || !yamlDoc || !missingImports.length) {
    return { markers: [], problems: [] };
  }

  const lineInfo = extractImportLineInfo(yamlDoc, content);
  const markers = missingImports.map(({ alias, path }) => {
    const info = lineInfo.find((entry) => entry.alias === alias) || lineInfo.find((entry) => entry.path === path);
    const targetLine = info?.line || 1;
    const lineNumber = Math.min(Math.max(targetLine, 1), model.getLineCount());
    return {
      startLineNumber: lineNumber,
      startColumn: 1,
      endLineNumber: lineNumber,
      endColumn: model.getLineMaxColumn(lineNumber),
      message: `Imported file "${path}" was not found.`,
      severity: monaco.MarkerSeverity.Warning,
    };
  });

  return {
    markers,
    problems: markers.map((marker) => ({
      message: marker.message,
      severity: "warning" as const,
      line: marker.startLineNumber,
      column: marker.startColumn,
    })),
  };
}

export function computeOrderingMarkers(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null
): { markers: any[]; problems: ProblemEntry[] } {
  const expectedOrder = getCanonicalOrder(docType);
  if (!expectedOrder || !content.trim() || !model || !yamlDoc) {
    return { markers: [], problems: [] };
  }

  const issue = detectOrderingIssue(yamlDoc, content, expectedOrder);
  const markers = issue
    ? [
        {
          startLineNumber: issue.line,
          startColumn: 1,
          endLineNumber: issue.line,
          endColumn: model.getLineMaxColumn(issue.line),
          message: issue.message,
          severity: monaco.MarkerSeverity.Warning,
        },
      ]
    : [];

  return {
    markers,
    problems: issue
      ? [{ message: issue.message, severity: "warning" as const, line: issue.line, column: 1 }]
      : [],
  };
}

export function findTestCallAliasProblems(
  content: string,
  yamlDoc: any,
  docType: string | null,
  importsMap: Record<string, string>
): ProblemEntry[] {
  if (docType !== "test" || !yamlDoc) {
    return [];
  }

  const importKeys = new Set(Object.keys(importsMap || {}));
  return extractTestCallSites(yamlDoc, content)
    .filter((site) => !importKeys.has(site.alias))
    .map((site) => ({
      message: `${site.alias} is not imported`,
      severity: "warning" as const,
      line: site.line,
      column: 1,
      alias: site.alias,
    }));
}

export function findTestCallInputsProblems(
  content: string,
  yamlDoc: any,
  docType: string | null,
  importedInputsByAlias: Record<string, string[]> | null
): ProblemEntry[] {
  if (docType !== "test" || !yamlDoc || !importedInputsByAlias) {
    return [];
  }

  const allowedByAlias = new Map<string, Set<string>>();
  for (const [alias, keys] of Object.entries(importedInputsByAlias)) {
    allowedByAlias.set(alias, new Set((Array.isArray(keys) ? keys : []).filter((k) => typeof k === "string")));
  }

  const keySites = extractTestCallInputKeySites(yamlDoc, content);
  return keySites
    .filter((site) => allowedByAlias.has(site.alias) && !allowedByAlias.get(site.alias)!.has(site.inputKey))
    .map((site) => ({
      message: `Input "${site.inputKey}" is not defined in imported "${site.alias}"`,
      severity: "warning" as const,
      line: site.line,
      column: 1,
      inputKey: site.inputKey,
      alias: site.alias,
    }));
}

export function computeTestCallAliasMarkers(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  importsMap: Record<string, string>,
  docType: string | null
): { markers: any[]; problems: ProblemEntry[] } {
  if (!model || !yamlDoc) {
    return { markers: [], problems: [] };
  }

  const problems = findTestCallAliasProblems(content, yamlDoc, docType, importsMap);
  const markers = problems.map((problem) => {
    const lineNumber = Math.min(Math.max(problem.line ?? 1, 1), model.getLineCount());
    return {
      startLineNumber: lineNumber,
      startColumn: problem.column ?? 1,
      endLineNumber: lineNumber,
      endColumn: model.getLineMaxColumn(lineNumber),
      message: problem.message,
      severity: monaco.MarkerSeverity.Warning,
    };
  });

  return { markers, problems };
}

export function getUndefinedInputDecorations(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  importedInputsByAlias: Record<string, string[]> | null,
  inlineClassName: string
): any[] {
  if (!model || !yamlDoc || docType !== "test" || !importedInputsByAlias) {
    return [];
  }

  const allowedByAlias = new Map<string, Set<string>>();
  for (const [alias, keys] of Object.entries(importedInputsByAlias)) {
    allowedByAlias.set(alias, new Set((Array.isArray(keys) ? keys : []).filter((k) => typeof k === "string")));
  }

  const keySites = extractTestCallInputKeySites(yamlDoc, content);
  const decorations: any[] = [];

  for (const site of keySites) {
    if (!allowedByAlias.has(site.alias) || allowedByAlias.get(site.alias)!.has(site.inputKey)) {
      continue;
    }
    if (site.offset < 0) {
      continue;
    }
    const hoverMessage = { value: `Input "${site.inputKey}" is not defined in imported "${site.alias}"` };
    const start = model.getPositionAt(site.offset);
    const end = model.getPositionAt(site.offset + site.inputKey.length);
    decorations.push({
      range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
      options: {
        inlineClassName,
        hoverMessage,
      },
    });
  }

  return decorations;
}

export function computeTestCallInputsMarkers(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  importedInputsByAlias: Record<string, string[]> | null
): { markers: any[]; problems: ProblemEntry[] } {
  if (!model || !yamlDoc) {
    return { markers: [], problems: [] };
  }

  const problems = findTestCallInputsProblems(content, yamlDoc, docType, importedInputsByAlias);
  const markers = problems.map((problem) => {
    const lineNumber = Math.min(Math.max(problem.line ?? 1, 1), model.getLineCount());
    return {
      startLineNumber: lineNumber,
      startColumn: problem.column ?? 1,
      endLineNumber: lineNumber,
      endColumn: model.getLineMaxColumn(lineNumber),
      message: problem.message,
      severity: monaco.MarkerSeverity.Warning,
    };
  });

  return { markers, problems };
}

export type SuiteTestLineInfo = {
  path: string;
  line: number;
};

export function extractSuiteTestLineInfo(doc: any, content: string): SuiteTestLineInfo[] {
  const items: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const testsPair = items.find((entry) => entry?.key?.value === "tests");
  if (!testsPair || !testsPair.value) {
    return [];
  }
  const seqItems: any[] = Array.isArray(testsPair.value.items) ? testsPair.value.items : [];
  return seqItems
    .map((item) => {
      const path = typeof item?.value === "string" ? item.value : undefined;
      if (!path || path === 'then') {
        return null;
      }
      const offset =
        Array.isArray(item?.range) && typeof item.range[0] === "number"
          ? item.range[0]
          : undefined;
      const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
      return { path, line } as SuiteTestLineInfo;
    })
    .filter(Boolean) as SuiteTestLineInfo[];
}


export function computeMissingSuiteFileMarkers(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  missingSuiteFiles: { path: string }[]
): { markers: any[]; problems: ProblemEntry[] } {
  if (!model || !yamlDoc || !missingSuiteFiles.length) {
    return { markers: [], problems: [] };
  }

  const lineInfo = extractSuiteTestLineInfo(yamlDoc, content);
  const markers = missingSuiteFiles.map(({ path }) => {
    const info = lineInfo.find((entry) => entry.path === path);
    const targetLine = info?.line || 1;
    const lineNumber = Math.min(Math.max(targetLine, 1), model.getLineCount());
    return {
      startLineNumber: lineNumber,
      startColumn: 1,
      endLineNumber: lineNumber,
      endColumn: model.getLineMaxColumn(lineNumber),
      message: `Suite file "${path}" was not found.`,
      severity: monaco.MarkerSeverity.Warning,
    };
  });

  return {
    markers,
    problems: markers.map((marker) => ({
      message: marker.message,
      severity: "warning" as const,
      line: marker.startLineNumber,
      column: marker.startColumn,
    })),
  };
}

export type DocFileLineInfo = {
  path: string;
  line: number;
  column: number;
};

// This function is no longer needed in validator.ts, as its logic is now part of useDocFileValidation
// export function extractDocFileLineInfo(doc: any, content: string): DocFileLineInfo | null {
//   const items: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
//   const logoPair = items.find((entry) => entry?.key?.value === "logo");
//   if (!logoPair || !logoPair.value) {
//     return null;
//   }
//   const path = typeof logoPair.value.value === "string" ? logoPair.value.value : undefined;
//   if (!path) {
//     return null;
//   }
//   const offset =
//     Array.isArray(logoPair.value?.range) && typeof logoPair.value.range[0] === "number"
//       ? logoPair.value.range[0]
//       : undefined;
//   const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
//   return { path, line };
// }

export function computeMissingDocFileMarkers(
  monaco: any,
  model: any,
  missingDocFiles: { path: string, line: number, column: number, message: string }[]
): { markers: any[]; problems: ProblemEntry[] } {
  if (!model || !missingDocFiles.length) {
    return { markers: [], problems: [] };
  }

  const markers = missingDocFiles.map((missingFile) => {
    const lineNumber = Math.min(Math.max(missingFile.line ?? 1, 1), model.getLineCount());
    const column = missingFile.column ?? 1;
    return {
      startLineNumber: lineNumber,
      startColumn: column,
      endLineNumber: lineNumber,
      endColumn: model.getLineMaxColumn(lineNumber),
      message: missingFile.message,
      severity: monaco.MarkerSeverity.Warning,
    };
  });

  return {
    markers,
    problems: markers.map((marker) => ({
      message: marker.message,
      severity: "warning" as const,
      line: marker.startLineNumber,
      column: marker.startColumn,
    })),
  };
}

