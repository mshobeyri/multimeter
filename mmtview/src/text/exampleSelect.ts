import {parseYamlDoc} from 'mmt-core/markupConvertor';

export const SELECT_EXAMPLE_EVENT = 'mmt-select-example';

export type ExampleNameTarget = {
  exampleIndex: number;
  name: string;
  range: any;
};

type ExampleNameHit = {
  exampleIndex: number;
  name: string;
  startOffset: number;
  endOffset: number;
};

function offsetToPosition(content: string, offset: number): {line: number, column: number} {
  let line = 1;
  let column = 1;
  const limit = Math.min(Math.max(0, offset), content.length);
  for (let i = 0; i < limit; i++) {
    if (content.charCodeAt(i) === 10) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return {line, column};
}

function scalarRangeOffsets(node: any): {start: number, end: number}|null {
  if (!node || !Array.isArray(node.range) || typeof node.range[0] !== 'number') {
    return null;
  }
  const start = node.range[0];
  // yaml range is [start, end, end] where end is exclusive past the scalar.
  const end = typeof node.range[1] === 'number' ? node.range[1] : start;
  if (end <= start) {
    return null;
  }
  return {start, end};
}

/**
 * Collect `examples[].id` (preferred) or legacy `examples[].name` value spans
 * from the YAML AST (for Ctrl+click).
 */
export function collectExampleNameHits(content: string): ExampleNameHit[] {
  const hits: ExampleNameHit[] = [];
  let doc: any;
  try {
    doc = parseYamlDoc(content);
  } catch {
    return hits;
  }
  if (doc?.errors?.length) {
    return hits;
  }
  const rootItems: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const examplesPair = rootItems.find((item) => item?.key?.value === 'examples');
  const seqItems: any[] =
      Array.isArray(examplesPair?.value?.items) ? examplesPair.value.items : [];

  seqItems.forEach((exampleNode, idx) => {
    if (!exampleNode || !Array.isArray(exampleNode.items)) {
      return;
    }
    const idPair = exampleNode.items.find((pair: any) => pair?.key?.value === 'id');
    const namePair = exampleNode.items.find((pair: any) => pair?.key?.value === 'name');
    const pair = idPair || namePair;
    const value = pair?.value?.value;
    if (typeof value !== 'string' || !value.trim()) {
      return;
    }
    const range = scalarRangeOffsets(pair.value);
    if (!range) {
      return;
    }
    hits.push({
      exampleIndex: idx,
      name: value,
      startOffset: range.start,
      endOffset: range.end,
    });
  });
  return hits;
}

function positionToOffset(content: string, lineNumber: number, column: number): number {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let offset = 0;
  for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
    offset += lines[i].length + 1;
  }
  return offset + Math.max(0, column - 1);
}

/** Ctrl/Cmd+hover/click target for an example `id:` / legacy `name:` value. */
export function getExampleNameTargetAtPosition(
    monaco: any,
    model: any,
    content: string,
    pos: {lineNumber: number, column: number}|null|undefined,
): ExampleNameTarget|null {
  if (!monaco || !model || !pos || !content) {
    return null;
  }
  const offset = positionToOffset(content, pos.lineNumber, pos.column);
  const hits = collectExampleNameHits(content);
  const hit = hits.find((item) => offset >= item.startOffset && offset < item.endOffset);
  if (!hit) {
    return null;
  }
  const start = offsetToPosition(content, hit.startOffset);
  const end = offsetToPosition(content, hit.endOffset);
  return {
    exampleIndex: hit.exampleIndex,
    name: hit.name,
    range: new monaco.Range(start.line, start.column, end.line, end.column),
  };
}

export function dispatchSelectExample(exampleIndex: number): void {
  if (!Number.isInteger(exampleIndex) || exampleIndex < 0) {
    return;
  }
  window.dispatchEvent(new CustomEvent(SELECT_EXAMPLE_EVENT, {
    detail: {exampleIndex},
  }));
}
