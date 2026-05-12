/**
 * Pure graph model used by the flowchart view. No React, no @xyflow/react
 * imports here so this file is trivially unit-testable.
 */

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
}

export type EdgeKind = 'sequence' | 'branch-true' | 'branch-false' | 'parallel';

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
