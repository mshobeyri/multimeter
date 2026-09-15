import {SuiteYamlFilter} from './SuiteData';

export interface TagFilter {
  /** AND across layers; OR within a layer. Absent/empty = all. */
  only?: string[][];
  /** Union of skip tags (OR). Absent/empty = none. */
  skip?: string[];
}

export type TagRunDecision = 'run'|'skip'|'descend';

export function normalizeTagList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const tag = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
    if (!tag || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

export function parseSuiteYamlFilter(raw: unknown): SuiteYamlFilter|undefined {
  if (raw == null) {
    return undefined;
  }
  if (Array.isArray(raw)) {
    const only = normalizeTagList(raw);
    return only.length ? {only} : undefined;
  }
  if (typeof raw !== 'object') {
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  const only = normalizeTagList(obj.only);
  const skip = normalizeTagList(obj.skip);
  if (!only.length && !skip.length) {
    return undefined;
  }
  const filter: SuiteYamlFilter = {};
  if (only.length) {
    filter.only = only;
  }
  if (skip.length) {
    filter.skip = skip;
  }
  return filter;
}

export function tagFilterFromYaml(yaml?: SuiteYamlFilter|null): TagFilter {
  const only = normalizeTagList(yaml?.only);
  const skip = normalizeTagList(yaml?.skip);
  return {
    only: only.length ? [only] : undefined,
    skip: skip.length ? skip : undefined,
  };
}

export function tagFilterFromLists(only?: string[], skip?: string[]): TagFilter {
  return tagFilterFromYaml({only, skip});
}

export function isEmptyTagFilter(filter?: TagFilter|null): boolean {
  if (!filter) {
    return true;
  }
  const hasOnly = Array.isArray(filter.only) && filter.only.some((layer) => layer.length > 0);
  const hasSkip = Array.isArray(filter.skip) && filter.skip.length > 0;
  return !hasOnly && !hasSkip;
}

/** Nested running suite: only layers AND, skip tags OR. */
export function mergeTagFilter(parent: TagFilter, nested: TagFilter): TagFilter {
  const only: string[][] = [];
  for (const layer of parent.only ?? []) {
    if (layer.length) {
      only.push(layer);
    }
  }
  for (const layer of nested.only ?? []) {
    if (layer.length) {
      only.push(layer);
    }
  }
  const skip = normalizeTagList([...(parent.skip ?? []), ...(nested.skip ?? [])]);
  return {
    only: only.length ? only : undefined,
    skip: skip.length ? skip : undefined,
  };
}

export function nodeMatchesAny(tags: readonly string[]|undefined, wanted: readonly string[]|undefined): boolean {
  if (!wanted || wanted.length === 0) {
    return false;
  }
  if (!tags || tags.length === 0) {
    return false;
  }
  const have = new Set(tags);
  return wanted.some((tag) => have.has(tag));
}

export function matchesOnly(tags: readonly string[]|undefined, filter: TagFilter): boolean {
  const layers = filter.only;
  if (!layers || layers.length === 0) {
    return true;
  }
  return layers.every((layer) => layer.length === 0 || nodeMatchesAny(tags, layer));
}

export function matchesSkip(tags: readonly string[]|undefined, filter: TagFilter): boolean {
  return nodeMatchesAny(tags, filter.skip);
}

/**
 * only first, then skip. parentSelected = ancestor suite was selected by only
 * (whole subtree except skip).
 */
export function decideTagRun(
    kind: 'test'|'suite',
    tags: readonly string[]|undefined,
    filter: TagFilter,
    parentSelected: boolean,
    ): TagRunDecision {
  if (matchesSkip(tags, filter)) {
    return 'skip';
  }
  if (parentSelected) {
    return 'run';
  }
  if (matchesOnly(tags, filter)) {
    return 'run';
  }
  if (kind === 'suite') {
    return 'descend';
  }
  return 'skip';
}
