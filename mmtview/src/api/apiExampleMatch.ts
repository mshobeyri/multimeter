import { JSONRecord } from "mmt-core/CommonData";
import { ExampleData } from "mmt-core/APIData";

/** Stable JSON equality for input maps (key order independent). */
export function inputsEqual(a?: JSONRecord | null, b?: JSONRecord | null): boolean {
  return stableStringify(a || {}) === stableStringify(b || {});
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(sortKeysDeep(value));
  } catch {
    return String(value);
  }
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeysDeep(obj[key]);
    }
    return out;
  }
  return value;
}

/**
 * Find the first example whose `inputs` exactly match `currentInputs`.
 * Returns -1 when none match (UI should show "Select...").
 */
export function findMatchingExampleIndex(
  examples: Array<ExampleData | null | undefined> | undefined,
  currentInputs?: JSONRecord | null,
): number {
  if (!examples || examples.length === 0) {
    return -1;
  }
  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    if (!example || typeof example !== "object") {
      continue;
    }
    if (inputsEqual(example.inputs, currentInputs)) {
      return i;
    }
  }
  return -1;
}
