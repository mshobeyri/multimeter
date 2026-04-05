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
        "environment",
        "servers",
        "export",
        "tests",
      ];
    case "doc":
      return ["type", "title", "description", "logo", "sources", "services", "html", "env"];
    case "server":
      return [
        "type",
        "title",
        "description",
        "tags",
        "protocol",
        "port",
        "tls",
        "cors",
        "delay",
        "headers",
        "proxy",
        "endpoints",
        "fallback",
      ];
    case "report":
      return [
        "type",
        "name",
        "timestamp",
        "duration",
        "summary",
        "cancelled",
        "suites",
      ];
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

/**
 * Canonical key orders for step types (must match core/testParsePack).
 */
const STEP_KEY_ORDER: Record<string, string[]> = {
  call:   ['call', 'id', 'title', 'inputs', 'expect', 'debug', 'report'],
  check:  ['check'],
  assert: ['assert'],
  if:     ['if', 'steps', 'else'],
  for:    ['for', 'steps'],
  repeat: ['repeat', 'steps'],
  delay:  ['delay'],
  js:     ['js'],
  print:  ['print'],
  run:    ['run'],
  set:    ['set'],
  var:    ['var'],
  const:  ['const'],
  let:    ['let'],
  data:   ['data'],
  setenv: ['setenv'],
};
const CHECK_ASSERT_VALUE_ORDER = ['title', 'actual', 'operator', 'expected', 'report', 'details'];
const STAGE_KEY_ORDER = ['id', 'title', 'condition', 'after', 'steps'];
const SERVER_ENDPOINT_KEY_ORDER = ['method', 'path', 'name', 'match', 'status', 'format', 'headers', 'body', 'delay', 'reflect', 'messages'];

/** Detect the step type from a YAML map node's key-value pairs. */
function detectStepTypeFromPairs(pairs: any[]): string | null {
  const stepTypes = Object.keys(STEP_KEY_ORDER);
  for (const pair of pairs) {
    const k = pair?.key?.value;
    if (typeof k === 'string' && stepTypes.includes(k)) {
      return k;
    }
  }
  return null;
}

/** Check if a map node's keys are out of canonical order, returning the first issue. */
function detectKeysOutOfOrder(
  pairs: any[],
  expectedOrder: string[],
  content: string,
  contextLabel: string
): OrderingIssue | null {
  const orderMap = new Map<string, number>();
  expectedOrder.forEach((key, idx) => orderMap.set(key, idx));
  let lastIdx = -1;
  let lastKey: string | undefined;
  for (const pair of pairs) {
    const key = pair?.key?.value;
    if (typeof key !== 'string' || !orderMap.has(key)) {
      continue;
    }
    const currentIdx = orderMap.get(key) ?? 0;
    if (currentIdx < lastIdx) {
      const offset = Array.isArray(pair?.key?.range) ? pair.key.range[0] : undefined;
      const line = typeof offset === 'number' ? offsetToLineNumber(content, offset) : 1;
      const message = lastKey
        ? `${contextLabel}: '${key}' should appear before '${lastKey}'. Use Format Document (Shift+Alt+F) to fix it.`
        : `${contextLabel}: '${key}' is out of order. Use Format Document (Shift+Alt+F) to fix it.`;
      return { line, key, prevKey: lastKey, message };
    }
    lastIdx = currentIdx;
    lastKey = key;
  }
  return null;
}

/**
 * Recursively detect ordering issues within step-level items.
 * Returns the first issue found, or null.
 */
function detectStepLevelOrderingIssue(seqItems: any[], content: string): OrderingIssue | null {
  for (const stepNode of seqItems) {
    const pairs: any[] = Array.isArray(stepNode?.items) ? stepNode.items : [];
    if (pairs.length === 0) {
      continue;
    }

    const stepType = detectStepTypeFromPairs(pairs);
    if (!stepType) {
      continue;
    }

    // Check step-level key order
    const stepOrder = STEP_KEY_ORDER[stepType];
    if (stepOrder && stepOrder.length > 1) {
      const issue = detectKeysOutOfOrder(pairs, stepOrder, content, `Step '${stepType}'`);
      if (issue) {
        return issue;
      }
    }

    // For check/assert with object-form value, check inner key order
    if (stepType === 'check' || stepType === 'assert') {
      const mainPair = pairs.find((p: any) => p?.key?.value === stepType);
      const innerPairs: any[] = Array.isArray(mainPair?.value?.items) ? mainPair.value.items : [];
      if (innerPairs.length > 1) {
        const issue = detectKeysOutOfOrder(innerPairs, CHECK_ASSERT_VALUE_ORDER, content, `${stepType} fields`);
        if (issue) {
          return issue;
        }
      }
    }

    // Recurse into nested steps
    const nestedStepsPair = pairs.find((p: any) => p?.key?.value === 'steps');
    const nestedSeq: any[] = Array.isArray(nestedStepsPair?.value?.items) ? nestedStepsPair.value.items : [];
    if (nestedSeq.length) {
      const issue = detectStepLevelOrderingIssue(nestedSeq, content);
      if (issue) {
        return issue;
      }
    }

    // Recurse into else branch
    const elsePair = pairs.find((p: any) => p?.key?.value === 'else');
    const elseSeq: any[] = Array.isArray(elsePair?.value?.items) ? elsePair.value.items : [];
    if (elseSeq.length) {
      const issue = detectStepLevelOrderingIssue(elseSeq, content);
      if (issue) {
        return issue;
      }
    }
  }
  return null;
}

/** Detect ordering issues inside stages (stage-level keys and their nested steps). */
function detectStageOrderingIssue(stagesSeq: any[], content: string): OrderingIssue | null {
  for (const stageNode of stagesSeq) {
    const pairs: any[] = Array.isArray(stageNode?.items) ? stageNode.items : [];
    if (pairs.length > 1) {
      const issue = detectKeysOutOfOrder(pairs, STAGE_KEY_ORDER, content, 'Stage');
      if (issue) {
        return issue;
      }
    }
    // Check nested steps within the stage
    const stepsPair = pairs.find((p: any) => p?.key?.value === 'steps');
    const stepsSeq: any[] = Array.isArray(stepsPair?.value?.items) ? stepsPair.value.items : [];
    if (stepsSeq.length) {
      const issue = detectStepLevelOrderingIssue(stepsSeq, content);
      if (issue) {
        return issue;
      }
    }
  }
  return null;
}

/**
 * Detect the first step-level or stage-level ordering issue in a test document.
 */
export function detectTestStepOrderingIssue(doc: any, content: string): OrderingIssue | null {
  const rootItems: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];

  // Check steps
  const stepsPair = rootItems.find((item: any) => item?.key?.value === 'steps');
  if (stepsPair?.value?.items) {
    const stepsSeq: any[] = Array.isArray(stepsPair.value.items) ? stepsPair.value.items : [];
    const issue = detectStepLevelOrderingIssue(stepsSeq, content);
    if (issue) {
      return issue;
    }
  }

  // Check stages
  const stagesPair = rootItems.find((item: any) => item?.key?.value === 'stages');
  if (stagesPair?.value?.items) {
    const stagesSeq: any[] = Array.isArray(stagesPair.value.items) ? stagesPair.value.items : [];
    const issue = detectStageOrderingIssue(stagesSeq, content);
    if (issue) {
      return issue;
    }
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

export type CallExpectKeyInfo = {
  alias: string;
  expectKey: string;
  line: number;
  offset: number;
};

function collectCallExpectKeySitesFromSteps(seqItems: any[], content: string, results: CallExpectKeyInfo[]): void {
  for (const stepNode of seqItems) {
    const stepPairs: any[] = Array.isArray(stepNode?.items) ? stepNode.items : [];
    const callPair = stepPairs.find((pair) => pair?.key?.value === "call");
    const alias = callPair?.value?.value;
    if (typeof alias === "string" && alias.trim()) {
      // Collect keys from both expect and debug blocks
      for (const blockKey of ["expect", "debug"]) {
        const blockPair = stepPairs.find((pair) => pair?.key?.value === blockKey);
        const blockPairs: any[] = Array.isArray(blockPair?.value?.items) ? blockPair.value.items : [];

        for (const pair of blockPairs) {
          const expectKey = pair?.key?.value;
          if (typeof expectKey !== "string" || !expectKey.trim()) {
            continue;
          }
          const offset =
            Array.isArray(pair?.key?.range) && typeof pair.key.range[0] === "number"
              ? pair.key.range[0]
              : Array.isArray(pair?.range)
                ? pair.range[0]
                : undefined;
          const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
          results.push({ alias, expectKey, line, offset: typeof offset === "number" ? offset : -1 });
        }
      }
    }
    // Recurse into nested steps (repeat, for, if, etc.)
    const nestedStepsPair = stepPairs.find((pair) => pair?.key?.value === "steps");
    const nestedSeq: any[] = Array.isArray(nestedStepsPair?.value?.items) ? nestedStepsPair.value.items : [];
    if (nestedSeq.length) {
      collectCallExpectKeySitesFromSteps(nestedSeq, content, results);
    }
  }
}

export function extractTestCallExpectKeySites(doc: any, content: string): CallExpectKeyInfo[] {
  if (!doc?.contents?.items) {
    return [];
  }

  const rootItems: any[] = Array.isArray(doc.contents.items) ? doc.contents.items : [];
  const stepsPair = rootItems.find((item) => item?.key?.value === "steps");
  if (!stepsPair?.value?.items) {
    return [];
  }

  const infos: CallExpectKeyInfo[] = [];
  collectCallExpectKeySitesFromSteps(stepsPair.value.items, content, infos);
  return infos;
}

export function getUndefinedExpectKeyDecorations(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  importedOutputsByAlias: Record<string, string[]> | null,
  inlineClassName: string
): any[] {
  if (!model || !yamlDoc || docType !== "test" || !importedOutputsByAlias) {
    return [];
  }

  const allowedByAlias = new Map<string, Set<string>>();
  for (const [alias, keys] of Object.entries(importedOutputsByAlias)) {
    const keySet = new Set((Array.isArray(keys) ? keys : []).filter((k) => typeof k === "string"));
    allowedByAlias.set(alias, keySet);
  }

  const keySites = extractTestCallExpectKeySites(yamlDoc, content);
  const decorations: any[] = [];

  for (const site of keySites) {
    if (!allowedByAlias.has(site.alias) || allowedByAlias.get(site.alias)!.has(site.expectKey)) {
      continue;
    }
    if (site.offset < 0) {
      continue;
    }
    const hoverMessage = { value: `Output "${site.expectKey}" is not defined in imported "${site.alias}"` };
    const start = model.getPositionAt(site.offset);
    const end = model.getPositionAt(site.offset + site.expectKey.length);
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

/**
 * Detect the first endpoint-level ordering issue in a server document.
 */
function detectServerEndpointOrderingIssue(doc: any, content: string): OrderingIssue | null {
  const rootItems: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const endpointsPair = rootItems.find((item: any) => item?.key?.value === 'endpoints');
  if (!endpointsPair?.value?.items) {
    return null;
  }
  const endpointsSeq: any[] = Array.isArray(endpointsPair.value.items) ? endpointsPair.value.items : [];
  for (const epNode of endpointsSeq) {
    const pairs: any[] = Array.isArray(epNode?.items) ? epNode.items : [];
    if (pairs.length > 1) {
      const issue = detectKeysOutOfOrder(pairs, SERVER_ENDPOINT_KEY_ORDER, content, 'Endpoint');
      if (issue) {
        return issue;
      }
    }
  }
  return null;
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

  // Check root-level key ordering first
  const issue = detectOrderingIssue(yamlDoc, content, expectedOrder);

  // If no root-level issue, check step/stage-level ordering for test documents
  const stepIssue = !issue && docType === 'test'
    ? detectTestStepOrderingIssue(yamlDoc, content)
    : null;

  // If no root-level issue, check endpoint-level ordering for server documents
  const endpointIssue = !issue && !stepIssue && docType === 'server'
    ? detectServerEndpointOrderingIssue(yamlDoc, content)
    : null;

  const effectiveIssue = issue || stepIssue || endpointIssue;

  const markers = effectiveIssue
    ? [
        {
          startLineNumber: effectiveIssue.line,
          startColumn: 1,
          endLineNumber: effectiveIssue.line,
          endColumn: model.getLineMaxColumn(effectiveIssue.line),
          message: effectiveIssue.message,
          severity: monaco.MarkerSeverity.Warning,
        },
      ]
    : [];

  return {
    markers,
    problems: effectiveIssue
      ? [{ message: effectiveIssue.message, severity: "warning" as const, line: effectiveIssue.line, column: 1 }]
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

export type ExampleKeySiteInfo = {
  key: string;
  section: "inputs" | "outputs";
  exampleIndex: number;
  offset: number;
  line: number;
};

/**
 * Walk the `examples` array in an API YAML doc and collect every key under
 * each example's `inputs` / `outputs` mapping together with its byte offset.
 */
export function extractApiExampleKeySites(doc: any, content: string): ExampleKeySiteInfo[] {
  const rootItems: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const examplesPair = rootItems.find((item: any) => item?.key?.value === "examples");
  if (!examplesPair?.value?.items) {
    return [];
  }

  const results: ExampleKeySiteInfo[] = [];
  const examplesSeq: any[] = Array.isArray(examplesPair.value.items) ? examplesPair.value.items : [];

  for (let idx = 0; idx < examplesSeq.length; idx++) {
    const exampleNode = examplesSeq[idx];
    const examplePairs: any[] = Array.isArray(exampleNode?.items) ? exampleNode.items : [];

    for (const section of ["inputs", "outputs"] as const) {
      const sectionPair = examplePairs.find((pair: any) => pair?.key?.value === section);
      if (!sectionPair?.value?.items) {
        continue;
      }
      const mapItems: any[] = Array.isArray(sectionPair.value.items) ? sectionPair.value.items : [];
      for (const pair of mapItems) {
        const key = pair?.key?.value;
        if (typeof key !== "string" || !key.trim()) {
          continue;
        }
        const offset =
          Array.isArray(pair?.key?.range) && typeof pair.key.range[0] === "number"
            ? pair.key.range[0]
            : Array.isArray(pair?.range)
              ? pair.range[0]
              : undefined;
        const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
        results.push({ key, section, exampleIndex: idx, offset: typeof offset === "number" ? offset : -1, line });
      }
    }
  }

  return results;
}

/**
 * Extract the set of key names declared under the root-level `inputs` or
 * `outputs` mapping in an API YAML document.
 */
function extractApiLevelKeys(doc: any, field: "inputs" | "outputs"): Set<string> {
  const rootItems: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const pair = rootItems.find((item: any) => item?.key?.value === field);
  if (!pair?.value?.items) {
    return new Set();
  }
  const mapItems: any[] = Array.isArray(pair.value.items) ? pair.value.items : [];
  const keys = new Set<string>();
  for (const item of mapItems) {
    const k = item?.key?.value;
    if (typeof k === "string" && k.trim()) {
      keys.add(k);
    }
  }
  return keys;
}

/**
 * Produce Monaco inline decorations (yellow wavy underline) for every key
 * inside an example's `inputs` / `outputs` that does not exist in the
 * corresponding API-level `inputs` / `outputs` declaration.
 */
export function getUndefinedExampleKeyDecorations(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  inlineClassName: string
): any[] {
  if (!model || !yamlDoc || docType !== "api") {
    return [];
  }

  const apiInputs = extractApiLevelKeys(yamlDoc, "inputs");
  const apiOutputs = extractApiLevelKeys(yamlDoc, "outputs");

  // If neither inputs nor outputs are declared, nothing to warn about
  if (apiInputs.size === 0 && apiOutputs.size === 0) {
    return [];
  }

  const sites = extractApiExampleKeySites(yamlDoc, content);
  const decorations: any[] = [];

  for (const site of sites) {
    const allowed = site.section === "inputs" ? apiInputs : apiOutputs;
    // Skip if the API doesn't declare this section at all
    if (allowed.size === 0) {
      continue;
    }
    if (allowed.has(site.key)) {
      continue;
    }
    if (site.offset < 0) {
      continue;
    }

    const sectionLabel = site.section === "inputs" ? "inputs" : "outputs";
    const hoverMessage = { value: `"${site.key}" is not defined in API ${sectionLabel}` };
    const start = model.getPositionAt(site.offset);
    const end = model.getPositionAt(site.offset + site.key.length);
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

/**
 * Produce ProblemEntry items for example keys that don't match API-level
 * inputs/outputs (for the problems panel).
 */
export function findExampleKeyProblems(
  content: string,
  yamlDoc: any,
  docType: string | null
): ProblemEntry[] {
  if (docType !== "api" || !yamlDoc) {
    return [];
  }

  const apiInputs = extractApiLevelKeys(yamlDoc, "inputs");
  const apiOutputs = extractApiLevelKeys(yamlDoc, "outputs");

  if (apiInputs.size === 0 && apiOutputs.size === 0) {
    return [];
  }

  const sites = extractApiExampleKeySites(yamlDoc, content);
  return sites
    .filter((site) => {
      const allowed = site.section === "inputs" ? apiInputs : apiOutputs;
      return allowed.size > 0 && !allowed.has(site.key);
    })
    .map((site) => {
      const sectionLabel = site.section === "inputs" ? "inputs" : "outputs";
      return {
        message: `"${site.key}" is not defined in API ${sectionLabel}`,
        severity: "warning" as const,
        line: site.line,
        column: 1,
      };
    });
}

export type InputRefSiteInfo = {
  name: string;
  offset: number;
  length: number;
  line: number;
};

/**
 * Scan the raw YAML content for `i:xxx` and `<<i:xxx>>` references and
 * return their positions. We match:
 *   - `<<i:name>>` — brace-wrapped form
 *   - `i:name`     — plain form (word-boundary delimited)
 *
 * Comment lines (starting with `#`) are skipped.
 */
export function extractInputRefSites(content: string): InputRefSiteInfo[] {
  const results: InputRefSiteInfo[] = [];

  // Match <<i:name>> — capture the full `i:name` and just `name`
  const braceRe = /<<\s*i:([a-zA-Z_][a-zA-Z0-9_]*)\s*>>/g;
  let m: RegExpExecArray | null;
  while ((m = braceRe.exec(content)) !== null) {
    const name = m[1];
    const fullMatchOffset = m.index;
    const line = offsetToLineNumber(content, fullMatchOffset);
    // Check if this is on a comment line
    const lineStart = content.lastIndexOf('\n', fullMatchOffset) + 1;
    const linePrefix = content.slice(lineStart, fullMatchOffset).trimStart();
    if (linePrefix.startsWith('#')) {
      continue;
    }
    // Underline just the `i:name` portion inside `<<i:name>>`
    const innerOffset = content.indexOf('i:' + name, fullMatchOffset);
    const underlineOffset = innerOffset >= 0 ? innerOffset : fullMatchOffset;
    const underlineLength = innerOffset >= 0 ? ('i:' + name).length : m[0].length;
    results.push({ name, offset: underlineOffset, length: underlineLength, line });
  }

  // Match plain i:name (word-boundary delimited, not inside << >>)
  const plainRe = /\bi:([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  while ((m = plainRe.exec(content)) !== null) {
    const name = m[1];
    const fullMatchOffset = m.index;
    // Skip if this is inside a <<...>> (already handled above)
    const before = content.slice(Math.max(0, fullMatchOffset - 10), fullMatchOffset);
    if (/<<\s*$/.test(before)) {
      continue;
    }
    const line = offsetToLineNumber(content, fullMatchOffset);
    // Check if this is on a comment line
    const lineStart = content.lastIndexOf('\n', fullMatchOffset) + 1;
    const linePrefix = content.slice(lineStart, fullMatchOffset).trimStart();
    if (linePrefix.startsWith('#')) {
      continue;
    }
    results.push({ name, offset: fullMatchOffset, length: m[0].length, line });
  }

  return results;
}

/**
 * Produce Monaco inline decorations (yellow wavy underline) for `i:xxx`
 * and `<<i:xxx>>` references whose name is not declared in the file-level
 * `inputs` (works for both API and test files).
 */
export function getUndefinedInputRefDecorations(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  inlineClassName: string
): any[] {
  if (!model || !yamlDoc || (docType !== "api" && docType !== "test")) {
    return [];
  }

  const declaredInputs = extractApiLevelKeys(yamlDoc, "inputs");
  if (declaredInputs.size === 0) {
    return [];
  }

  const sites = extractInputRefSites(content);
  const decorations: any[] = [];

  for (const site of sites) {
    if (declaredInputs.has(site.name)) {
      continue;
    }
    if (site.offset < 0) {
      continue;
    }

    const label = docType === "test" ? "test" : "API";
    const hoverMessage = { value: `Input "${site.name}" is not defined in ${label} inputs` };
    const start = model.getPositionAt(site.offset);
    const end = model.getPositionAt(site.offset + site.length);
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

/**
 * Produce ProblemEntry items for `i:xxx` / `<<i:xxx>>` references that don't
 * match any declared file-level input (works for both API and test files).
 */
export function findInputRefProblems(
  content: string,
  yamlDoc: any,
  docType: string | null
): ProblemEntry[] {
  if ((docType !== "api" && docType !== "test") || !yamlDoc) {
    return [];
  }

  const declaredInputs = extractApiLevelKeys(yamlDoc, "inputs");
  if (declaredInputs.size === 0) {
    return [];
  }

  const label = docType === "test" ? "test" : "API";
  const sites = extractInputRefSites(content);
  return sites
    .filter((site) => !declaredInputs.has(site.name))
    .map((site) => ({
      message: `Input "${site.name}" is not defined in ${label} inputs`,
      severity: "warning" as const,
      line: site.line,
      column: 1,
    }));
}

export type EnvRefSiteInfo = {
  name: string;
  offset: number;
  length: number;
  line: number;
};

/**
 * Scan the raw YAML content for `e:xxx`, `<<e:xxx>>`, `<e:xxx>`, and `e:{xxx}`
 * references and return their positions.
 * Comment lines (starting with `#`) are skipped.
 */
export function extractEnvRefSites(content: string): EnvRefSiteInfo[] {
  const results: EnvRefSiteInfo[] = [];
  const seen = new Set<number>(); // track offsets to avoid duplicates

  function isCommentLine(offset: number): boolean {
    const lineStart = content.lastIndexOf('\n', offset) + 1;
    return content.slice(lineStart, offset).trimStart().startsWith('#');
  }

  // Match <<e:NAME>> — brace-wrapped
  const braceRe = /<<\s*e:([A-Za-z_][A-Za-z0-9_]*)\s*>>/g;
  let m: RegExpExecArray | null;
  while ((m = braceRe.exec(content)) !== null) {
    if (isCommentLine(m.index)) {
      continue;
    }
    const name = m[1];
    // Underline the `e:NAME` portion
    const innerOffset = content.indexOf('e:' + name, m.index);
    const underlineOffset = innerOffset >= 0 ? innerOffset : m.index;
    const underlineLength = innerOffset >= 0 ? ('e:' + name).length : m[0].length;
    seen.add(underlineOffset);
    results.push({ name, offset: underlineOffset, length: underlineLength, line: offsetToLineNumber(content, m.index) });
  }

  // Match <e:NAME> — single-angle
  const singleAngleRe = /<\s*e:([A-Za-z_][A-Za-z0-9_]*)\s*>/g;
  while ((m = singleAngleRe.exec(content)) !== null) {
    if (isCommentLine(m.index)) {
      continue;
    }
    // Skip if already covered by <<...>>
    const innerOffset = content.indexOf('e:' + m[1], m.index);
    const offset = innerOffset >= 0 ? innerOffset : m.index;
    if (seen.has(offset)) {
      continue;
    }
    seen.add(offset);
    const underlineLength = innerOffset >= 0 ? ('e:' + m[1]).length : m[0].length;
    results.push({ name: m[1], offset, length: underlineLength, line: offsetToLineNumber(content, m.index) });
  }

  // Match e:{NAME}
  const curlyRe = /\be:\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
  while ((m = curlyRe.exec(content)) !== null) {
    if (isCommentLine(m.index)) {
      continue;
    }
    if (seen.has(m.index)) {
      continue;
    }
    seen.add(m.index);
    results.push({ name: m[1], offset: m.index, length: m[0].length, line: offsetToLineNumber(content, m.index) });
  }

  // Match plain e:NAME (word-boundary delimited)
  const plainRe = /\be:([A-Za-z_][A-Za-z0-9_]*)\b/g;
  while ((m = plainRe.exec(content)) !== null) {
    if (isCommentLine(m.index)) {
      continue;
    }
    if (seen.has(m.index)) {
      continue;
    }
    // Skip if inside << >> or < > or e:{}
    const before = content.slice(Math.max(0, m.index - 10), m.index);
    if (/<<\s*$/.test(before) || /<\s*$/.test(before)) {
      continue;
    }
    seen.add(m.index);
    results.push({ name: m[1], offset: m.index, length: m[0].length, line: offsetToLineNumber(content, m.index) });
  }

  return results;
}

/**
 * Produce Monaco inline decorations (yellow wavy underline) for `e:xxx`
 * references whose name is not in the known environment variable set.
 */
export function getUndefinedEnvRefDecorations(
  monaco: any,
  model: any,
  content: string,
  knownEnvNames: Set<string>,
  inlineClassName: string
): any[] {
  if (!model || knownEnvNames.size === 0) {
    return [];
  }

  const sites = extractEnvRefSites(content);
  const decorations: any[] = [];

  for (const site of sites) {
    if (knownEnvNames.has(site.name)) {
      continue;
    }
    if (site.offset < 0) {
      continue;
    }

    const hoverMessage = { value: `Environment variable "${site.name}" is not defined` };
    const start = model.getPositionAt(site.offset);
    const end = model.getPositionAt(site.offset + site.length);
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

/**
 * Produce ProblemEntry items for `e:xxx` references that don't match any
 * known environment variable.
 */
export function findEnvRefProblems(
  content: string,
  knownEnvNames: Set<string>
): ProblemEntry[] {
  if (knownEnvNames.size === 0) {
    return [];
  }

  const sites = extractEnvRefSites(content);
  return sites
    .filter((site) => !knownEnvNames.has(site.name))
    .map((site) => ({
      message: `Environment variable "${site.name}" is not defined`,
      severity: "warning" as const,
      line: site.line,
      column: 1,
    }));
}


/**
 * Detect root-level `description:` keys whose value spans multiple lines
 * without a YAML block-scalar indicator (`|` or `>`).  Returns a warning
 * for each occurrence so the user can add the indicator.
 */
export function findMultilineDescriptionProblems(content: string): ProblemEntry[] {
  const lines = content.split('\n');
  const results: ProblemEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (!/^description:(\s|$)/.test(trimmed)) {
      continue;
    }

    const descIndent = lines[i].search(/\S/);
    const afterColon = trimmed.slice('description:'.length).trim();

    // Already using a block-scalar indicator — nothing to warn about
    if (/^[|>]/.test(afterColon)) {
      continue;
    }

    // Count continuation lines indented deeper than the key
    let continuationCount = 0;
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j];
      if (nextLine.trim() === '') {
        let hasMore = false;
        for (let k = j + 1; k < lines.length; k++) {
          if (lines[k].trim() === '') {
            continue;
          }
          hasMore = lines[k].search(/\S/) > descIndent;
          break;
        }
        if (hasMore) {
          continuationCount++;
          continue;
        }
        break;
      }
      if (nextLine.search(/\S/) > descIndent) {
        continuationCount++;
      } else {
        break;
      }
    }

    if (continuationCount >= 1) {
      results.push({
        message: 'Multiline description should use "|" block scalar indicator',
        severity: 'warning' as const,
        line: i + 1, // 1-based
        column: 1,
      });
    }
  }

  return results;
}

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

// --- Output value keyword validation for API files ---

/** Valid base keywords for the right-hand side of output mapping expressions. */
const VALID_OUTPUT_KEYWORDS = new Set([
  "body", "header", "headers", "status", "details", "duration", "cookies",
]);

export type OutputValueSiteInfo = {
  key: string;
  value: string;
  offset: number;
  line: number;
};

/**
 * Extract sites for the values (right-hand side) of the root-level `outputs`
 * mapping in an API YAML document.
 */
function extractApiOutputValueSites(doc: any, content: string): OutputValueSiteInfo[] {
  const rootItems: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const outputsPair = rootItems.find((item: any) => item?.key?.value === "outputs");
  if (!outputsPair?.value?.items) {
    return [];
  }

  const mapItems: any[] = Array.isArray(outputsPair.value.items) ? outputsPair.value.items : [];
  const results: OutputValueSiteInfo[] = [];

  for (const item of mapItems) {
    const key = item?.key?.value;
    const val = item?.value?.value;
    if (typeof key !== "string" || typeof val !== "string" || !val.trim()) {
      continue;
    }
    const offset =
      Array.isArray(item?.value?.range) && typeof item.value.range[0] === "number"
        ? item.value.range[0]
        : -1;
    const line = offset >= 0 ? offsetToLineNumber(content, offset) : 1;
    results.push({ key, value: val, offset, line });
  }

  return results;
}

/**
 * Check whether an output extraction expression starts with a valid keyword.
 * Valid patterns:
 * - Plain keyword: body, header, headers, status, details, duration, cookies
 * - Keyword with path: body[...], body.field, header[...], header.field
 * - JSONPath: $...
 * - Regex: regex ..., or section[/pattern/], or section./pattern/
 */
function isValidOutputExpression(expr: string): boolean {
  const trimmed = expr.trim();
  if (!trimmed) {
    return false;
  }

  // JSONPath expressions
  if (trimmed.startsWith("$")) {
    return true;
  }

  // Legacy regex prefix
  if (trimmed.startsWith("regex ")) {
    return true;
  }

  // Regex capture group: expression contains (...)
  if (/\(.*\)/.test(trimmed)) {
    return true;
  }

  // Extract the base keyword (before any [ or . or whitespace)
  const baseMatch = trimmed.match(/^([a-zA-Z_]+)/);
  if (!baseMatch) {
    return false;
  }

  const base = baseMatch[1].toLowerCase();
  return VALID_OUTPUT_KEYWORDS.has(base);
}

/**
 * Produce Monaco inline decorations (yellow wavy underline) for every output
 * value in an API file whose extraction expression does not start with a valid keyword.
 */
export function getUndefinedOutputValueDecorations(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  inlineClassName: string
): any[] {
  if (!model || !yamlDoc || docType !== "api") {
    return [];
  }

  const sites = extractApiOutputValueSites(yamlDoc, content);
  const decorations: any[] = [];

  for (const site of sites) {
    if (isValidOutputExpression(site.value)) {
      continue;
    }
    if (site.offset < 0) {
      continue;
    }

    const hoverMessage = { value: `"${site.value}" does not start with a valid keyword (body, header, status, details, duration). If this is a regex extract, wrap the entire regex in parentheses \`()\`` };
    const start = model.getPositionAt(site.offset);
    const end = model.getPositionAt(site.offset + site.value.length);
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

// --- Stage `after` validation ---

export type StageAfterSiteInfo = {
  afterValue: string;
  line: number;
  offset: number;
};

/**
 * Extract all stage IDs and `after` value sites from a test document's stages.
 */
function extractStageAfterInfo(doc: any, content: string): {
  stageIds: Set<string>;
  afterSites: StageAfterSiteInfo[];
} {
  const stageIds = new Set<string>();
  const afterSites: StageAfterSiteInfo[] = [];

  const rootItems: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const stagesPair = rootItems.find((item: any) => item?.key?.value === "stages");
  if (!stagesPair?.value?.items) {
    return { stageIds, afterSites };
  }

  const stagesSeq: any[] = Array.isArray(stagesPair.value.items) ? stagesPair.value.items : [];

  for (const stageNode of stagesSeq) {
    const pairs: any[] = Array.isArray(stageNode?.items) ? stageNode.items : [];
    const idPair = pairs.find((p: any) => p?.key?.value === "id");
    const id = idPair?.value?.value;
    if (typeof id === "string" && id.trim()) {
      stageIds.add(id);
    }

    const afterPair = pairs.find((p: any) => p?.key?.value === "after");
    if (!afterPair) {
      continue;
    }

    const afterValue = afterPair?.value;
    if (!afterValue) {
      continue;
    }

    // after can be a single string or an array of strings
    if (typeof afterValue.value === "string" && afterValue.value.trim()) {
      const offset = Array.isArray(afterValue.range) ? afterValue.range[0] : -1;
      const line = typeof offset === "number" && offset >= 0 ? offsetToLineNumber(content, offset) : 1;
      afterSites.push({ afterValue: afterValue.value, line, offset });
    } else if (Array.isArray(afterValue.items)) {
      for (const item of afterValue.items) {
        const val = item?.value;
        if (typeof val === "string" && val.trim()) {
          const offset = Array.isArray(item.range) ? item.range[0] : -1;
          const line = typeof offset === "number" && offset >= 0 ? offsetToLineNumber(content, offset) : 1;
          afterSites.push({ afterValue: val, line, offset });
        }
      }
    }
  }

  return { stageIds, afterSites };
}

/**
 * Find problems where `after` references a stage ID that does not exist.
 */
export function findStageAfterProblems(
  content: string,
  yamlDoc: any,
  docType: string | null
): ProblemEntry[] {
  if (docType !== "test" || !yamlDoc) {
    return [];
  }

  const { stageIds, afterSites } = extractStageAfterInfo(yamlDoc, content);
  return afterSites
    .filter((site) => !stageIds.has(site.afterValue))
    .map((site) => ({
      message: `"${site.afterValue}" is not a valid stage id`,
      severity: "error" as const,
      line: site.line,
      column: 1,
    }));
}

/**
 * Compute Monaco markers for invalid `after` references.
 */
export function computeStageAfterMarkers(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null
): { markers: any[]; problems: ProblemEntry[] } {
  if (!model || !yamlDoc) {
    return { markers: [], problems: [] };
  }

  const problems = findStageAfterProblems(content, yamlDoc, docType);
  const markers = problems.map((problem) => {
    const lineNumber = Math.min(Math.max(problem.line ?? 1, 1), model.getLineCount());
    return {
      startLineNumber: lineNumber,
      startColumn: problem.column ?? 1,
      endLineNumber: lineNumber,
      endColumn: model.getLineMaxColumn(lineNumber),
      message: problem.message,
      severity: monaco.MarkerSeverity.Error,
    };
  });

  return { markers, problems };
}

/**
 * Create editor decorations (underline) for invalid `after` references.
 */
export function getInvalidStageAfterDecorations(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  inlineClassName: string
): any[] {
  if (!model || !yamlDoc || docType !== "test") {
    return [];
  }

  const { stageIds, afterSites } = extractStageAfterInfo(yamlDoc, content);
  const decorations: any[] = [];

  for (const site of afterSites) {
    if (stageIds.has(site.afterValue)) {
      continue;
    }
    if (site.offset < 0) {
      continue;
    }
    const hoverMessage = { value: `"${site.afterValue}" is not a valid stage id` };
    const start = model.getPositionAt(site.offset);
    const end = model.getPositionAt(site.offset + site.afterValue.length);
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