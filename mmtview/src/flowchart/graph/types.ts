/**
 * Pure graph model used by the flowchart view. No React, no @xyflow/react
 * imports here so this file is trivially unit-testable.
 */

import type { TestData } from 'mmt-core/TestData';

export type NodeKind =
  | 'start'
  | 'end'
  | 'call'
  | 'run'
  | 'assert'
  | 'check'
  | 'set'
  | 'sleep'
  | 'print'
  | 'js'
  | 'if'
  | 'loop'
  | 'repeat'
  | 'data'
  | 'setenv'
  | 'stage'
  | 'group'
  | 'suite'
  | 'test-ref'
  | 'missing'
  | 'message';

export interface FlowNode {
  id: string;
  kind: NodeKind;
  /** Short title shown as the node's primary text. */
  label: string;
  /** Optional single-line subtitle (URL, comparison, duration, ...). */
  detail?: string;
  /** File path opened when the user clicks the node. */
  sourceFile?: string;
  /** If set, this node is laid out inside its parent (container). */
  parentId?: string;
  /** Explicit width/height for container-style nodes. Filled in by the layout step. */
  width?: number;
  height?: number;
  /** True if this node visually contains other nodes (e.g. test bodies). */
  isContainer?: boolean;
}

export type EdgeKind = 'sequence' | 'branch-true' | 'branch-false' | 'parallel' | 'loop-back' | 'layout';

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind?: EdgeKind;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowCallImportInfo {
  kind: 'api' | 'test';
  title?: string;
  filePath?: string;
  test?: TestData;
  callImportByAlias?: Record<string, FlowCallImportInfo | undefined>;
}

export type FlowCallImportMap = Record<string, FlowCallImportInfo | undefined>;
