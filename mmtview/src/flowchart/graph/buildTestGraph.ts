import { TestData, TestFlowStep, TestFlowSteps, TestFlowStage } from 'mmt-core/TestData';
import { getTestFlowStepType } from 'mmt-core/testParsePack';
import { FlowEdge, FlowGraph, FlowNode, NodeKind } from './types';

export interface BuildTestGraphInput {
  test: TestData;
  /** Absolute or workspace-relative path to the test file. */
  filePath?: string;
}

/** Build a flow graph for a single test file. */
export function buildTestGraph(input: BuildTestGraphInput): FlowGraph {
  const builder = new TestGraphBuilder(input.filePath);
  builder.startNode();
  const stages = (input.test as any).stages as TestFlowStage[] | undefined;
  if (Array.isArray(stages) && stages.length > 0) {
    builder.buildStages(stages);
  } else {
    const steps = ((input.test as any).steps as TestFlowSteps | undefined) ?? [];
    const tail = builder.buildSteps(steps, [builder.startId]);
    builder.endNode(tail);
    return builder.toGraph();
  }
  return builder.toGraph();
}

class TestGraphBuilder {
  nodes: FlowNode[] = [];
  edges: FlowEdge[] = [];
  startId = 'n-start';
  endId = 'n-end';
  private counter = 0;
  constructor(private readonly filePath?: string) {}

  toGraph(): FlowGraph {
    return { nodes: this.nodes, edges: this.edges };
  }

  startNode(): void {
    this.pushNode({ id: this.startId, kind: 'start', label: 'START TRIGGER' });
  }

  endNode(tails: string[]): void {
    this.pushNode({ id: this.endId, kind: 'end', label: 'END POINT' });
    for (const t of tails) {
      this.connect(t, this.endId);
    }
  }

  /**
   * Build a sequence of steps. Returns the IDs of the tail node(s) that the
   * caller should connect to whatever comes next. For a linear sequence the
   * array has a single id; for a branching `if` step it may have multiple.
   */
  buildSteps(steps: TestFlowSteps, prevTails: string[]): string[] {
    let currentTails = prevTails;
    for (const step of steps ?? []) {
      currentTails = this.buildStep(step, currentTails);
    }
    return currentTails;
  }

  private buildStep(step: TestFlowStep, prevTails: string[]): string[] {
    const kind = getTestFlowStepType(step);
    if (kind === 'if') {
      return this.buildIf(step as any, prevTails);
    }
    if (kind === 'for' || kind === 'repeat') {
      return this.buildLoop(step as any, kind, prevTails);
    }
    const nodeId = this.nextId(kind);
    const { mappedKind, label, detail } = mapLeaf(step, kind);
    this.pushNode({
      id: nodeId,
      kind: mappedKind,
      label,
      detail,
      sourceFile: this.filePath,
    });
    for (const t of prevTails) {
      this.connect(t, nodeId);
    }
    return [nodeId];
  }

  private buildIf(step: any, prevTails: string[]): string[] {
    const id = this.nextId('if');
    const condition = describeComparison(step.if);
    this.pushNode({ id, kind: 'if', label: 'if', detail: condition, sourceFile: this.filePath });
    for (const t of prevTails) {
      this.connect(t, id);
    }
    const thenSteps = (step.steps as TestFlowSteps) ?? [];
    const elseSteps = (step.else as TestFlowSteps) ?? [];

    const tails: string[] = [];

    if (thenSteps.length > 0) {
      // Tag the first edge as branch-true so the layout/edge styling can
      // differentiate.
      const beforeEdgeCount = this.edges.length;
      const trueTail = this.buildSteps(thenSteps, [id]);
      if (this.edges.length > beforeEdgeCount) {
        this.edges[beforeEdgeCount].label = 'then';
        this.edges[beforeEdgeCount].kind = 'branch-true';
      }
      tails.push(...trueTail);
    } else {
      tails.push(id);
    }

    if (elseSteps.length > 0) {
      const beforeEdgeCount = this.edges.length;
      const falseTail = this.buildSteps(elseSteps, [id]);
      if (this.edges.length > beforeEdgeCount) {
        this.edges[beforeEdgeCount].label = 'else';
        this.edges[beforeEdgeCount].kind = 'branch-false';
      }
      tails.push(...falseTail);
    } else {
      // No else branch: the if itself is a possible passthrough.
      tails.push(id);
    }
    return tails;
  }

  private buildLoop(step: any, kind: 'for' | 'repeat', prevTails: string[]): string[] {
    const id = this.nextId(kind);
    const detail = kind === 'for' ? String(step.for ?? '') : String(step.repeat ?? '');
    this.pushNode({
      id,
      kind: kind === 'for' ? 'loop' : 'repeat',
      label: kind === 'for' ? 'for' : 'repeat',
      detail,
      sourceFile: this.filePath,
    });
    for (const t of prevTails) {
      this.connect(t, id);
    }
    const bodyTail = this.buildSteps((step.steps as TestFlowSteps) ?? [], [id]);
    return bodyTail.length ? bodyTail : [id];
  }

  buildStages(stages: TestFlowStage[]): void {
    // Map stage id -> {entryId, exitTails}
    const stageInfo = new Map<string, { entry: string; tails: string[] }>();
    // First pass: emit a stage node per stage and build its body.
    for (const stage of stages) {
      const stageId = this.nextId('stage');
      this.pushNode({
        id: stageId,
        kind: 'stage',
        label: stage.title || stage.id,
        detail: stage.condition ? describeComparison(stage.condition) : undefined,
        sourceFile: this.filePath,
      });
      const tails = this.buildSteps(stage.steps ?? [], [stageId]);
      stageInfo.set(stage.id, { entry: stageId, tails });
    }
    // Second pass: connect predecessors based on `after`.
    const afterMap = new Map<string, string[]>();
    for (const stage of stages) {
      const after = normalizeAfter(stage.after);
      afterMap.set(stage.id, after);
    }
    const allFinalTails: string[] = [];
    const hasSuccessor = new Set<string>();
    for (const stage of stages) {
      const after = afterMap.get(stage.id) ?? [];
      const info = stageInfo.get(stage.id)!;
      if (after.length === 0) {
        this.connect(this.startId, info.entry);
      } else {
        for (const predId of after) {
          const pred = stageInfo.get(predId);
          if (!pred) {
            continue;
          }
          hasSuccessor.add(predId);
          for (const t of pred.tails) {
            this.connect(t, info.entry);
          }
        }
      }
    }
    // Collect tails of stages with no successor → connect to END.
    for (const stage of stages) {
      if (!hasSuccessor.has(stage.id)) {
        const info = stageInfo.get(stage.id)!;
        allFinalTails.push(...info.tails);
      }
    }
    this.endNode(allFinalTails.length ? allFinalTails : [this.startId]);
  }

  private nextId(prefix: string): string {
    this.counter += 1;
    return `n-${prefix}-${this.counter}`;
  }

  private pushNode(node: FlowNode): void {
    this.nodes.push(node);
  }

  private connect(source: string, target: string, label?: string): void {
    this.edges.push({
      id: `e-${this.edges.length}-${source}-${target}`,
      source,
      target,
      label,
      kind: 'sequence',
    });
  }
}

function normalizeAfter(after: unknown): string[] {
  if (!after) {
    return [];
  }
  if (Array.isArray(after)) {
    return after.filter((s): s is string => typeof s === 'string' && s.length > 0);
  }
  if (typeof after === 'string' && after) {
    return [after];
  }
  return [];
}

interface LeafMapping {
  mappedKind: NodeKind;
  label: string;
  detail?: string;
}

function mapLeaf(step: any, kind: string): LeafMapping {
  switch (kind) {
    case 'call': {
      const label = (step.id as string) || (step.call as string) || 'call';
      const detail = describeCall(step);
      return { mappedKind: 'call', label, detail };
    }
    case 'run':
      return { mappedKind: 'run', label: 'run', detail: String(step.run ?? '') };
    case 'assert':
      return { mappedKind: 'assert', label: 'assert', detail: describeComparison(step.assert) };
    case 'check':
      return { mappedKind: 'check', label: 'check', detail: describeComparison(step.check) };
    case 'delay':
      return { mappedKind: 'sleep', label: 'sleep', detail: String(step.delay ?? '') };
    case 'print':
      return { mappedKind: 'print', label: 'print', detail: truncate(String(step.print ?? ''), 60) };
    case 'js':
      return { mappedKind: 'js', label: 'js', detail: truncate(String(step.js ?? ''), 60) };
    case 'set':
    case 'var':
    case 'const':
    case 'let':
      return { mappedKind: 'set', label: kind, detail: describeAssignments(step[kind]) };
    case 'data':
      return { mappedKind: 'data', label: 'data', detail: String(step.data ?? '') };
    case 'setenv':
      return { mappedKind: 'setenv', label: 'setenv', detail: describeAssignments(step.setenv) };
    default:
      return { mappedKind: 'message', label: kind || 'step' };
  }
}

function describeComparison(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return truncate(value, 80);
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, any>;
    const actual = obj.actual ?? '';
    const operator = obj.operator ?? '';
    const expected = obj.expected ?? '';
    return truncate(`${actual} ${operator} ${expected}`.trim(), 80);
  }
  return truncate(String(value), 80);
}

function describeCall(step: any): string | undefined {
  if (step.url) {
    return truncate(String(step.url), 80);
  }
  if (step.interface) {
    return truncate(String(step.interface), 80);
  }
  return undefined;
}

function describeAssignments(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 0) {
    return undefined;
  }
  return truncate(keys.join(', '), 60);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max - 1) + '…';
}
