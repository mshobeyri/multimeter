import React, { useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Node as RFNode,
  Edge as RFEdge,
  NodeMouseHandler,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TestData } from 'mmt-core/TestData';
import { buildTestGraph } from './graph/buildTestGraph';
import { buildSuiteGraph } from './graph/buildSuiteGraph';
import { applyLayout } from './graph/layout';
import { FlowGraph, FlowNode } from './graph/types';
import { nodeTypes } from './nodes/nodeRegistry';
import { edgeTypes } from './edges/edgeRegistry';
import { openRelativeFile } from '../vsAPI';
import { SuiteGroup } from '../suite/types';
import { SuiteTreeNode } from '../suite/test/suiteHierarchy';
import { useSuiteTestData } from './useSuiteTestData';
import { buildSingleTestTitleSpecs, buildSuiteTitleSpecs, useFlowchartCallTitles } from './useFlowchartCallTitles';

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

const EMPTY_SUITE_GROUPS: SuiteGroup[] = [];

function toRFNodes(graph: FlowGraph, positions: ReturnType<typeof applyLayout>): RFNode[] {
  // Sort so parent containers appear before their children — React Flow
  // requires this in order to position children relative to a parent.
  const sortedNodes = [...graph.nodes].sort((a, b) => {
    const ap = a.parentId ? 1 : 0;
    const bp = b.parentId ? 1 : 0;
    return ap - bp;
  });
  return sortedNodes.map((n: FlowNode) => {
    const pos = positions[n.id] ?? { x: 0, y: 0 };
    const rfNode: RFNode = {
      id: n.id,
      type: 'flowCard',
      position: { x: pos.x, y: pos.y },
      data: {
        kind: n.kind,
        label: n.label,
        detail: n.detail,
        sourceFile: n.sourceFile,
        isContainer: Boolean(n.isContainer),
        width: n.width,
        height: n.height,
      },
      draggable: false,
      selectable: false,
      connectable: false,
    };
    if (n.parentId) {
      rfNode.parentId = n.parentId;
      rfNode.extent = 'parent';
    }
    if (n.isContainer && n.width && n.height) {
      rfNode.style = { width: n.width, height: n.height };
    }
    return rfNode;
  });
}

function toRFEdges(graph: FlowGraph, positions: ReturnType<typeof applyLayout>): RFEdge[] {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  return graph.edges.filter((e) => e.kind !== 'layout').map((e) => {
    const color = e.kind === 'branch-true'
      ? '#3fb950'
      : e.kind === 'branch-false'
        ? '#f0883e'
        : 'var(--vscode-descriptionForeground, #6e7781)';
    const sourceNode = nodeById.get(e.source);
    const targetNode = nodeById.get(e.target);
    const parentNode = sourceNode?.parentId && sourceNode.parentId === targetNode?.parentId
      ? nodeById.get(sourceNode.parentId)
      : undefined;
    const parentPosition = parentNode ? positions[parentNode.id] : undefined;
    const loopBounds = e.kind === 'loop-back' && parentNode && parentPosition && parentNode.height
      ? {
        top: parentPosition.y,
        bottom: parentPosition.y + parentNode.height,
      }
      : undefined;
    const edgeStyle = { stroke: color, strokeDasharray: e.kind === 'sequence' ? undefined : '5 5' };
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: 'flowEdge',
      data: { kind: e.kind, loopBounds },
      style: edgeStyle,
      markerEnd: e.kind === 'loop-back'
        ? { type: MarkerType.ArrowClosed, color, width: 14, height: 14 }
        : undefined,
      labelStyle: { fill: color, fontSize: 11, fontWeight: 700 },
      labelBgStyle: {
        fill: 'var(--vscode-editor-background, #1f2428)',
        fillOpacity: 0.92,
      },
      animated: false,
    } as RFEdge;
  });
}

const FlowchartView: React.FC<FlowchartViewProps> = ({ source, onBack, title }) => {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const suiteGroups = source.kind === 'suite' ? source.groups : EMPTY_SUITE_GROUPS;
  const suiteHierarchy = source.kind === 'suite' ? source.hierarchyByEntryPath : undefined;
  const suiteMissingFiles = source.kind === 'suite' ? source.missingFiles : undefined;
  const suiteRootTitle = source.kind === 'suite' ? source.rootTitle : undefined;
  const suiteRootPath = source.kind === 'suite' ? source.rootPath : undefined;
  const test = source.kind === 'test' ? source.test : undefined;
  const testFilePath = source.kind === 'test' ? source.filePath : undefined;
  const testDataByPath = useSuiteTestData(suiteGroups, suiteHierarchy, source.kind === 'suite', refreshVersion);
  const titleSpecs = useMemo(
    () => source.kind === 'test'
      ? buildSingleTestTitleSpecs(test, testFilePath)
      : buildSuiteTitleSpecs(testDataByPath),
    [source.kind, test, testFilePath, testDataByPath],
  );
  const callTitleByTestPath = useFlowchartCallTitles(titleSpecs, source.kind === 'test' || Object.keys(testDataByPath).length > 0, refreshVersion);

  const graph = useMemo<FlowGraph>(() => {
    if (source.kind === 'test') {
      return buildTestGraph({
        test: test!,
        filePath: testFilePath,
        callTitleByAlias: callTitleByTestPath[testFilePath || '__current__'],
      });
    }
    return buildSuiteGraph({
      rootTitle: suiteRootTitle,
      rootPath: suiteRootPath,
      groups: suiteGroups,
      hierarchyByEntryPath: suiteHierarchy,
      missingFiles: suiteMissingFiles,
      testDataByPath,
      callTitleByTestPath,
    });
  }, [source.kind, test, testFilePath, suiteRootTitle, suiteRootPath, suiteGroups, suiteHierarchy, suiteMissingFiles, testDataByPath, callTitleByTestPath]);

  const positions = useMemo(() => applyLayout(graph), [graph]);
  const rfNodes = useMemo(() => toRFNodes(graph, positions), [graph, positions]);
  const rfEdges = useMemo(() => toRFEdges(graph, positions), [graph, positions]);

  const handleRefresh = React.useCallback(() => {
    setRefreshVersion((value) => value + 1);
  }, []);

  const handleNodeClick = React.useCallback<NodeMouseHandler>((_event, node) => {
    const data = node.data as { kind?: string; sourceFile?: string };
    const sourceFile = data?.sourceFile;
    const openable = sourceFile && data.kind !== 'group' && data.kind !== 'start' && data.kind !== 'end';
    if (openable) {
      openRelativeFile(sourceFile);
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
          <button
            className="action-button"
            onClick={handleRefresh}
            title="Refresh flow chart"
            type="button"
            style={{ marginLeft: 'auto' }}
          >
            <span className="codicon codicon-refresh" aria-hidden />
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ReactFlowProvider>
          <ReactFlow
            key={refreshVersion}
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
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
