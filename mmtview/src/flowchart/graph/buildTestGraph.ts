import { TestData, TestFlowStep, TestFlowSteps, TestFlowStage } from 'mmt-core/TestData';
import { getTestFlowStepType } from 'mmt-core/testParsePack';
import { FlowEdge, FlowGraph, FlowNode, NodeKind } from './types';

export interface BuildTestGraphInput {
  test: TestData;
  /** Absolute or workspace-relative path to the test file. */
  filePath?: string;
  /** Imported call alias -> imported API/test title. */
  callTitleByAlias?: Record<string, string | undefined>;
}

/** Build a flow graph for a single test file. */
export function buildTestGraph(input: BuildTestGraphInput): FlowGraph {
  const builder = new TestGraphBuilder(input.filePath, input.callTitleByAlias ?? {});
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
  private passthroughEdges = new Map<string, { label: string; kind: FlowEdge['kind'] }>();
  constructor(
    private readonly filePath?: string,
    private readonly callTitleByAlias: Record<string, string | undefined> = {},
  ) {}

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
    const { mappedKind, label, detail } = mapLeaf(step, kind, this.callTitleByAlias);
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
    this.pushNode({ id, kind: 'if', label: condition || 'if', sourceFile: this.filePath });
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
        this.edges[beforeEdgeCount].label = 'yes';
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
        this.edges[beforeEdgeCount].label = 'no';
        this.edges[beforeEdgeCount].kind = 'branch-false';
      }
      tails.push(...falseTail);
    } else {
      // No else branch: the if itself is a possible passthrough. The next
      // outgoing edge from the if node represents the `no` path.
      this.passthroughEdges.set(id, { label: 'no', kind: 'branch-false' });
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
      label: detail || (kind === 'for' ? 'for' : 'repeat'),
      sourceFile: this.filePath,
    });
    for (const t of prevTails) {
      this.connect(t, id);
    }
    const bodyTail = this.buildSteps((step.steps as TestFlowSteps) ?? [], [id]);
    for (const tail of bodyTail) {
      if (tail !== id) {
        this.connect(tail, id, 'loop', 'loop-back');
      }
    }
    return bodyTail.length ? bodyTail : [id];
  }

  buildStages(stages: TestFlowStage[]): void {
    const stageInfos: Array<{ key: string; id: string; entry: string; tails: string[] }> = [];
    const stageKeysById = new Map<string, string[]>();
    // First pass: emit a stage node per stage and build its body.
    stages.forEach((stage, index) => {
      const stageId = this.nextId('stage');
      const userStageId = stage.id || `stage_${index + 1}`;
      const key = `${userStageId}#${index}`;
      this.pushNode({
        id: stageId,
        kind: 'stage',
        label: stage.title || userStageId,
        detail: stage.condition ? describeComparison(stage.condition) : undefined,
        sourceFile: this.filePath,
      });
      const tails = this.buildSteps(stage.steps ?? [], [stageId]);
      stageInfos.push({ key, id: userStageId, entry: stageId, tails });
      const keys = stageKeysById.get(userStageId) ?? [];
      keys.push(key);
      stageKeysById.set(userStageId, keys);
    });

    const stageInfoByKey = new Map(stageInfos.map((info) => [info.key, info]));
    const allFinalTails: string[] = [];
    const hasSuccessor = new Set<string>();
    stages.forEach((stage, index) => {
      const userStageId = stage.id || `stage_${index + 1}`;
      const key = `${userStageId}#${index}`;
      const after = normalizeAfter(stage.after);
      const info = stageInfoByKey.get(key)!;
      if (after.length === 0) {
        this.connect(this.startId, info.entry);
      } else {
        for (const predId of after) {
          const predKeys = stageKeysById.get(predId) ?? [];
          for (const predKey of predKeys) {
            const pred = stageInfoByKey.get(predKey);
            if (!pred) {
              continue;
            }
            hasSuccessor.add(predKey);
            for (const t of pred.tails) {
              this.connect(t, info.entry);
            }
          }
        }
      }
    });
    // Collect tails of stages with no successor → connect to END.
    for (const info of stageInfos) {
      if (!hasSuccessor.has(info.key)) {
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

  private connect(source: string, target: string, label?: string, kind?: FlowEdge['kind']): void {
    const passthrough = this.passthroughEdges.get(source);
    if (passthrough) {
      this.passthroughEdges.delete(source);
    }
    this.edges.push({
      id: `e-${this.edges.length}-${source}-${target}`,
      source,
      target,
      label: label ?? passthrough?.label,
      kind: kind ?? passthrough?.kind ?? 'sequence',
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

function mapLeaf(step: any, kind: string, callTitleByAlias: Record<string, string | undefined>): LeafMapping {
  switch (kind) {
    case 'call': {
      const alias = step.call as string;
      const label = callTitleByAlias[alias] || alias || (step.id as string) || 'call';
      const detail = describeCall(step);
      return { mappedKind: 'call', label, detail };
    }
    case 'run':
      return { mappedKind: 'run', label: String(step.run ?? 'run') };
    case 'assert':
      return { mappedKind: 'assert', label: describeComparison(step.assert) || 'assert' };
    case 'check':
      return { mappedKind: 'check', label: describeComparison(step.check) || 'check' };
    case 'delay':
      return { mappedKind: 'sleep', label: String(step.delay ?? 'sleep') };
    case 'print':
      return { mappedKind: 'print', label: truncate(String(step.print ?? 'print'), 60) };
    case 'js':
      return { mappedKind: 'js', label: truncate(String(step.js ?? 'js'), 60) };
    case 'set':
    case 'var':
    case 'const':
    case 'let':
      return { mappedKind: 'set', label: describeAssignments(step[kind]) || kind };
    case 'data':
      return { mappedKind: 'data', label: String(step.data ?? 'data') };
    case 'setenv':
      return { mappedKind: 'setenv', label: describeAssignments(step.setenv) || 'setenv' };
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
  const parts: string[] = [];
  const inputs = describeObjectKeys(step.inputs);
  const outputs = describeObjectKeys(step.outputs);
  if (inputs) {
    parts.push(`inputs: ${inputs}`);
  }
  if (outputs) {
    parts.push(`outputs: ${outputs}`);
  }
  if (parts.length > 0) {
    return parts.join('\n');
  }
  if (step.url) {
    return truncate(String(step.url), 80);
  }
  if (step.interface) {
    return truncate(String(step.interface), 80);
  }
  return undefined;
}

function describeObjectKeys(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 0) {
    return undefined;
  }
  return truncate(keys.join(', '), 60);
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
