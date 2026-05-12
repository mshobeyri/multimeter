import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { EdgeKind } from '../graph/types';

interface FlowEdgeData {
  kind?: EdgeKind;
}

function labelPosition(sourceX: number, sourceY: number, targetX: number, targetY: number): { x: number; y: number } {
  return { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };
}

function routedBranchFalsePath(sourceX: number, sourceY: number, targetX: number, targetY: number): [string, number, number] {
  const gap = 90;
  const routeY = Math.min(sourceY, targetY) - gap;
  const startX = sourceX + 36;
  const endX = targetX - 36;
  const radius = 16;
  const path = [
    `M ${sourceX} ${sourceY}`,
    `L ${startX} ${sourceY}`,
    `Q ${startX + radius} ${sourceY} ${startX + radius} ${sourceY - radius}`,
    `L ${startX + radius} ${routeY + radius}`,
    `Q ${startX + radius} ${routeY} ${startX + radius * 2} ${routeY}`,
    `L ${endX - radius * 2} ${routeY}`,
    `Q ${endX - radius} ${routeY} ${endX - radius} ${routeY + radius}`,
    `L ${endX - radius} ${targetY - radius}`,
    `Q ${endX - radius} ${targetY} ${endX} ${targetY}`,
    `L ${targetX} ${targetY}`,
  ].join(' ');
  return [path, (startX + endX) / 2, routeY];
}

function loopBackPath(sourceX: number, sourceY: number, targetX: number, targetY: number): [string, number, number] {
  const gap = 96;
  const routeY = Math.max(sourceY, targetY) + gap;
  const path = [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX + 80} ${sourceY} ${sourceX + 80} ${routeY} ${sourceX} ${routeY}`,
    `L ${targetX} ${routeY}`,
    `C ${targetX - 80} ${routeY} ${targetX - 80} ${targetY} ${targetX} ${targetY}`,
  ].join(' ');
  return [path, (sourceX + targetX) / 2, routeY];
}

const FlowEdgeLine: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  label,
  markerEnd,
  data,
}) => {
  const edgeData = data as FlowEdgeData | undefined;
  let path: string;
  let labelX: number;
  let labelY: number;

  if (edgeData?.kind === 'branch-false' && Math.abs(targetX - sourceX) > 260) {
    [path, labelX, labelY] = routedBranchFalsePath(sourceX, sourceY, targetX, targetY);
  } else if (edgeData?.kind === 'loop-back') {
    [path, labelX, labelY] = loopBackPath(sourceX, sourceY, targetX, targetY);
  } else {
    const smooth = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
    path = smooth[0];
    labelX = smooth[1] ?? labelPosition(sourceX, sourceY, targetX, targetY).x;
    labelY = smooth[2] ?? labelPosition(sourceX, sourceY, targetX, targetY).y;
  }

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontSize: 11,
              fontWeight: 700,
              color: style?.stroke as string | undefined,
              background: 'var(--vscode-editor-background, #1f2428)',
              border: '1px solid var(--vscode-widget-border, rgba(255,255,255,0.12))',
              borderRadius: 4,
              padding: '1px 5px',
              pointerEvents: 'none',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default FlowEdgeLine;
