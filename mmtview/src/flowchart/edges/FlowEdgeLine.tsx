import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps } from '@xyflow/react';
import { EdgeKind } from '../graph/types';

interface FlowEdgeData {
  kind?: EdgeKind;
  loopBounds?: {
    top: number;
    bottom: number;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cleanStepPath(sourceX: number, sourceY: number, targetX: number, targetY: number): [string, number, number] {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  if (Math.abs(dy) < 6) {
    return [`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`, (sourceX + targetX) / 2, sourceY];
  }

  const direction = dx >= 0 ? 1 : -1;
  const gap = Math.abs(dx);
  const stub = clamp(gap * 0.28, 28, 82);
  const sourceTurnX = sourceX + direction * stub;
  const targetTurnX = targetX - direction * stub;
  const midY = sourceY + dy / 2;
  const radius = Math.min(10, Math.abs(dy) / 2, Math.max(4, gap / 10));

  if (direction * (targetTurnX - sourceTurnX) < 0) {
    const midX = sourceX + dx / 2;
    const path = [
      `M ${sourceX} ${sourceY}`,
      `L ${midX} ${sourceY}`,
      `L ${midX} ${targetY}`,
      `L ${targetX} ${targetY}`,
    ].join(' ');
    return [path, midX, midY];
  }

  const ySign = dy >= 0 ? 1 : -1;
  const path = [
    `M ${sourceX} ${sourceY}`,
    `L ${targetTurnX - direction * radius} ${sourceY}`,
    `Q ${targetTurnX} ${sourceY} ${targetTurnX} ${sourceY + ySign * radius}`,
    `L ${targetTurnX} ${targetY - ySign * radius}`,
    `Q ${targetTurnX} ${targetY} ${targetTurnX + direction * radius} ${targetY}`,
    `L ${targetX} ${targetY}`,
  ].join(' ');
  return [path, targetTurnX, midY];
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

function loopBackPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  bounds?: { top: number; bottom: number },
): [string, number, number] {
  const preferredY = Math.max(sourceY, targetY) + 42;
  const routeY = bounds
    ? clamp(preferredY, bounds.top + 76, bounds.bottom - 18)
    : preferredY;
  const sourceControlX = sourceX + 56;
  const targetControlX = targetX - 56;
  const path = [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceControlX} ${sourceY} ${sourceControlX} ${routeY} ${sourceX} ${routeY}`,
    `L ${targetX} ${routeY}`,
    `C ${targetControlX} ${routeY} ${targetControlX} ${targetY} ${targetX} ${targetY}`,
  ].join(' ');
  return [path, (sourceX + targetX) / 2, routeY];
}

const FlowEdgeLine: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
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
    [path, labelX, labelY] = loopBackPath(sourceX, sourceY, targetX, targetY, edgeData.loopBounds);
  } else {
    [path, labelX, labelY] = cleanStepPath(sourceX, sourceY, targetX, targetY);
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
