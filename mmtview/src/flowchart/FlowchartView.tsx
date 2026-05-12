import React, { useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Node as RFNode,
  Edge as RFEdge,
  NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TestData } from 'mmt-core/TestData';
import { buildTestGraph } from './graph/buildTestGraph';
import { buildSuiteGraph } from './graph/buildSuiteGraph';
import { applyLayout } from './graph/layout';
import { FlowGraph, FlowNode } from './graph/types';
import { nodeTypes } from './nodes/nodeRegistry';
import { openRelativeFile } from '../vsAPI';
import { SuiteGroup } from '../suite/types';
import { SuiteTreeNode } from '../suite/test/suiteHierarchy';

export type FlowchartSource =
  | {
    kind: 'test';
    test: TestData;
    filePath?: string;
  }
  | {
    kind: 'suite';
    rootTitle?: string;
    rootPath?: string;
    groups: SuiteGroup[];
    hierarchyByEntryPath?: Record<string, SuiteTreeNode | undefined>;
    missingFiles?: Set<string>;
  };

interface FlowchartViewProps {
  source: FlowchartSource;
  onBack: () => void;
  title?: string;
}

function toRFNodes(graph: FlowGraph): RFNode[] {
  const positions = applyLayout(graph);
  return graph.nodes.map((n: FlowNode) => {
    const pos = positions[n.id] ?? { x: 0, y: 0 };
    return {
      id: n.id,
      type: 'flowCard',
      position: { x: pos.x, y: pos.y },
      data: {
        kind: n.kind,
        label: n.label,
        detail: n.detail,
        sourceFile: n.sourceFile,
      },
      draggable: false,
      selectable: true,
      connectable: false,
    } as RFNode;
  });
}

function toRFEdges(graph: FlowGraph): RFEdge[] {
  return graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: 'smoothstep',
    style: { strokeDasharray: '5 5', stroke: 'var(--vscode-descriptionForeground, #6e7781)' },
    labelStyle: { fill: 'var(--vscode-descriptionForeground, #6e7781)', fontSize: 11 },
    animated: false,
  }));
}

const FlowchartView: React.FC<FlowchartViewProps> = ({ source, onBack, title }) => {
  const graph = useMemo<FlowGraph>(() => {
    if (source.kind === 'test') {
      return buildTestGraph({ test: source.test, filePath: source.filePath });
    }
    return buildSuiteGraph({
      rootTitle: source.rootTitle,
      rootPath: source.rootPath,
      groups: source.groups,
      hierarchyByEntryPath: source.hierarchyByEntryPath,
      missingFiles: source.missingFiles,
    });
  }, [source]);

  const rfNodes = useMemo(() => toRFNodes(graph), [graph]);
  const rfEdges = useMemo(() => toRFEdges(graph), [graph]);

  const handleNodeClick = React.useCallback<NodeMouseHandler>((_event, node) => {
    const data = node.data as { sourceFile?: string };
    if (data?.sourceFile) {
      openRelativeFile(data.sourceFile);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="api-edit-header">
        <div className="api-edit-header-row">
          <button
            className="action-button"
            onClick={onBack}
            title="Back"
            type="button"
          >
            <span className="codicon codicon-arrow-left" aria-hidden />
          </button>
          <div className="api-edit-title">
            <span className="codicon codicon-type-hierarchy-sub" aria-hidden style={{ marginRight: 6 }} />
            {title || 'Flow chart'}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            zoomOnDoubleClick={false}
            onNodeClick={handleNodeClick}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default FlowchartView;
