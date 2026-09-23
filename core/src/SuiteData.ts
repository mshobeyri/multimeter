export interface SuiteEnvironment {
  /** Preset name from multimeter.mmt (or `file` if specified) */
  preset?: string;
  /** Path to an env file to load (relative to suite or +/ project root) */
  file?: string;
  /** Inline key-value environment variables */
  variables?: Record<string, unknown>;
}

export interface SuiteYamlFilter {
  only?: string[];
  skip?: string[];
}

export interface SuiteData {
  type: 'suite';
  title?: string;
  description?: string;
  tags?: string[];
  /** Run-root / nested-run tag filter (only + skip). */
  filter?: SuiteYamlFilter;
  import?: Record<string, string>;
  servers?: string[];
  items: Array<string>;
  /** Environment configuration (root-only) */
  environment?: SuiteEnvironment;
  /** Export file paths to generate after suite completion (root-only) */
  export?: string[];
}

export type SuiteServerItemNode =
  | Extract<SuiteHierarchyNode, {kind: 'server'}>
  | Extract<SuiteHierarchyNode, {kind: 'missing'}>;

/** Resolved suite/test/server tree used by UI, cache, and bundle. */
export type SuiteHierarchyNode =
  | {kind: 'group'; id: string; label: string; children: SuiteHierarchyNode[]}
  | {
    kind: 'suite';
    id: string;
    path: string;
    title?: string;
    children: SuiteHierarchyNode[];
    servers?: string[];
    serverItems?: SuiteServerItemNode[];
    tags?: string[];
    filter?: SuiteYamlFilter;
  }
  | {kind: 'test'; id: string; path: string; title?: string; tags?: string[]}
  | {kind: 'server'; id: string; path: string; title?: string}
  | {kind: 'missing'; id: string; path: string}
  | {kind: 'cycle'; id: string; path: string};

export type SuiteHierarchyRootNode = Extract<SuiteHierarchyNode, {kind: 'suite'}> & {
  servers?: string[];
  environment?: SuiteEnvironment;
  export?: string[];
};

/** Cached tree: a suite root, or a single test/server leaf. */
export type SuiteHierarchyTree =
  | SuiteHierarchyRootNode
  | Extract<SuiteHierarchyNode, {kind: 'test'|'server'}>;
