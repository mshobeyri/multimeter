import { isMap, isPair, isScalar, isSeq } from 'yaml';

const BLOCK_LIST_KEYS = new Set(['steps', 'stages', 'flow', 'else']);

function pairKey(pair: { key: unknown }): string | undefined {
  if (isScalar(pair.key)) {
    return String(pair.key.value);
  }
  return undefined;
}

function normalizeStepSequence(seq: { flow?: boolean; items: unknown[] }): void {
  seq.flow = false;
  for (const item of seq.items) {
    if (isMap(item)) {
      item.flow = false;
      forceBlockStyleForStepSequences(item);
    } else {
      forceBlockStyleForStepSequences(item);
    }
  }
}

/** Step lists should always serialize as block `-` sequences, never flow `[...]`. */
export function forceBlockStyleForStepSequences(node: unknown): void {
  if (!node) {
    return;
  }
  if (isMap(node)) {
    for (const item of node.items) {
      if (!isPair(item)) {
        continue;
      }
      const key = pairKey(item);
      if (key && BLOCK_LIST_KEYS.has(key) && isSeq(item.value)) {
        normalizeStepSequence(item.value);
      } else {
        forceBlockStyleForStepSequences(item.value);
      }
    }
    return;
  }
  if (isSeq(node)) {
    for (const item of node.items) {
      forceBlockStyleForStepSequences(item);
    }
  }
}
