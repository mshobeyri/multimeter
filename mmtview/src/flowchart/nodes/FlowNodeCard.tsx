import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeKind } from '../graph/types';

export interface FlowNodeData {
  kind: NodeKind;
  label: string;
  detail?: string;
  sourceFile?: string;
  isContainer?: boolean;
  width?: number;
  height?: number;
}

interface KindStyle {
  icon: string;      // codicon name (no 'codicon-' prefix)
  color: string;     // accent color
  tag: string;       // small caps section tag, e.g. 'MESSAGE DATA'
  isTerminal?: boolean; // start/end nodes use a pill style
}

const KIND_STYLES: Record<NodeKind, KindStyle> = {
  start: { icon: 'play-circle', color: '#2ea043', tag: 'START TRIGGER', isTerminal: true },
  end: { icon: 'flag', color: '#cf222e', tag: 'END POINT', isTerminal: true },
  call: { icon: 'arrow-swap', color: '#1f6feb', tag: 'API CALL' },
  run: { icon: 'server-process', color: '#1f6feb', tag: 'RUN SERVER' },
  assert: { icon: 'shield', color: '#bc4c00', tag: 'ASSERT' },
  check: { icon: 'check-all', color: '#3fb950', tag: 'CHECK' },
  set: { icon: 'symbol-variable', color: '#8957e5', tag: 'SET' },
  sleep: { icon: 'watch', color: '#8957e5', tag: 'SLEEP' },
  print: { icon: 'output', color: '#6e7781', tag: 'PRINT' },
  js: { icon: 'symbol-method', color: '#8957e5', tag: 'JS' },
  if: { icon: 'git-compare', color: '#bf8700', tag: 'IF' },
  loop: { icon: 'sync', color: '#bf8700', tag: 'FOR' },
  repeat: { icon: 'sync', color: '#bf8700', tag: 'REPEAT' },
  data: { icon: 'database', color: '#1f6feb', tag: 'DATA' },
  setenv: { icon: 'gear', color: '#8957e5', tag: 'SETENV' },
  stage: { icon: 'layers', color: '#1f6feb', tag: 'STAGE' },
  group: { icon: 'folder', color: '#6e7781', tag: 'GROUP' },
  suite: { icon: 'list-tree', color: '#1f6feb', tag: 'SUITE' },
  'test-ref': { icon: 'beaker', color: '#1f6feb', tag: 'TEST' },
  missing: { icon: 'error', color: '#cf222e', tag: 'MISSING' },
  message: { icon: 'comment', color: '#1f6feb', tag: 'MESSAGE DATA' },
};

const cardBase: React.CSSProperties = {
  background: 'var(--vscode-editor-background, #1f2428)',
  border: '1px solid var(--vscode-widget-border, rgba(255,255,255,0.12))',
  borderRadius: 10,
  padding: '10px 14px',
  minWidth: 180,
  maxWidth: 260,
  boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
  fontFamily: 'var(--vscode-font-family, "Segoe UI", system-ui, sans-serif)',
  cursor: 'pointer',
  color: 'var(--vscode-foreground)',
};

const pillBase: React.CSSProperties = {
  ...cardBase,
  borderRadius: 24,
  padding: '6px 16px',
  minWidth: 130,
};

const tagStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: 'uppercase',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const detailStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.7,
  fontStyle: 'italic',
  marginTop: 4,
  whiteSpace: 'pre-line',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const FlowNodeCard: React.FC<NodeProps> = ({ data }) => {
  const d = data as unknown as FlowNodeData;
  const style = KIND_STYLES[d.kind] || KIND_STYLES.message;
  const isTerminal = !!style.isTerminal;
  const isOpenable = Boolean(d.sourceFile && d.kind !== 'group' && d.kind !== 'start' && d.kind !== 'end');
  const cursor = isOpenable ? 'pointer' : 'default';

  if (d.isContainer && d.width && d.height) {
    const containerStyle: React.CSSProperties = {
      width: d.width,
      height: d.height,
      background: 'var(--vscode-editorWidget-background, rgba(110, 118, 129, 0.08))',
      border: '1px solid var(--vscode-widget-border, rgba(255,255,255,0.12))',
      borderRadius: 12,
      padding: 0,
      fontFamily: 'var(--vscode-font-family, "Segoe UI", system-ui, sans-serif)',
      cursor,
      color: 'var(--vscode-foreground)',
      position: 'relative',
      boxSizing: 'border-box',
    };
    return (
      <div style={containerStyle} title={d.sourceFile}>
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 14,
            right: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pointerEvents: 'none',
          }}
        >
          <div style={{ ...tagStyle, color: style.color, marginBottom: 0 }}>
            <span className={`codicon codicon-${style.icon}`} aria-hidden />
            {style.tag}
          </div>
          <div style={{ ...labelStyle, fontSize: 13 }}>{d.label}</div>
        </div>
      </div>
    );
  }

  const rootStyle: React.CSSProperties = { ...(isTerminal ? pillBase : cardBase), cursor };

  return (
    <div style={rootStyle} title={d.sourceFile}>
      <Handle type="target" position={Position.Left} style={{ background: style.color }} />
      {isTerminal ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className={`codicon codicon-${style.icon}`}
            style={{ color: style.color, fontSize: 16 }}
            aria-hidden
          />
          <span style={{ ...labelStyle, color: style.color, letterSpacing: 1 }}>{style.tag}</span>
        </div>
      ) : (
        <>
          <div style={{ ...tagStyle, color: style.color }}>
            <span className={`codicon codicon-${style.icon}`} aria-hidden />
            {style.tag}
          </div>
          <div style={labelStyle}>{d.label}</div>
          {d.detail && <div style={detailStyle}>{d.detail}</div>}
        </>
      )}
      <Handle type="source" position={Position.Right} style={{ background: style.color }} />
    </div>
  );
};

export default FlowNodeCard;
