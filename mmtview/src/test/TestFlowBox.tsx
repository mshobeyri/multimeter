import React from "react";
import ReactDOM from "react-dom";
import { FlowType, CheckOps } from "mmt-core/TestData";
import TestCheck from "./TestCheck";
import TestCall from "./TestCall";
import TestFlowVar from "./TestFlowVar";
import TestFlowCSV from "./TestFlowCSV";

interface TestFlowBoxProps {
  data: any,
  onChange: (value: any) => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
  showExpand?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const TestFlowBox: React.FC<TestFlowBoxProps> = ({ data, onChange, onDuplicate, onRemove, showExpand, expanded, onToggleExpand }) => {
  const { type, stepData, testData } = data;
  const [openMenu, setOpenMenu] = React.useState(false);

  const Actions = () => {
    const btnRef = React.useRef<HTMLButtonElement | null>(null);
    const menuRef = React.useRef<HTMLDivElement | null>(null);
    const [menuPos, setMenuPos] = React.useState<{ left: number; top: number } | null>(null);

    const openAtButton = () => {
      const el = btnRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // place menu below button, right-aligned assuming ~160px width
      const left = Math.max(8, rect.right - 160);
      const top = rect.bottom + 4;
      setMenuPos({ left, top });
    };

    React.useEffect(() => {
      if (!openMenu) return;
      openAtButton();

      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node | null;
        if (menuRef.current?.contains(target as Node)) return;
        if (btnRef.current?.contains(target as Node)) return;
        setOpenMenu(false);
      };
      const handleScrollOrResize = () => {
        // close to avoid stale position on large moves; could also recompute
        setOpenMenu(false);
      };
      document.addEventListener('mousedown', handleClickOutside, true);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside, true);
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize, true);
      };
    }, [openMenu]);

    const menu = openMenu && menuPos ? (
      <div
        ref={menuRef}
        role="menu"
        style={{ position: 'fixed', left: menuPos.left, top: menuPos.top, zIndex: 1000, background: 'var(--vscode-editorWidget-background,#232323)', border: '1px solid var(--vscode-editorWidget-border,#333)', borderRadius: 4, boxShadow: '0 2px 6px rgba(0,0,0,0.4)', minWidth: 140, pointerEvents: 'auto' }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          role="menuitem"
          className="action-button"
          style={{ width: '100%', justifyContent: 'flex-start' }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => { e.stopPropagation(); setOpenMenu(false); onDuplicate?.(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenMenu(false); onDuplicate?.(); } }}
        >
          Duplicate
        </button>
        <button
          type="button"
          role="menuitem"
          className="action-button"
          style={{ width: '100%', justifyContent: 'flex-start' }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => { e.stopPropagation(); setOpenMenu(false); onRemove?.(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenMenu(false); onRemove?.(); } }}
        >
          Remove
        </button>
      </div>
    ) : null;

    return (
      <div style={{ marginLeft: 'auto', paddingRight: 8, display: 'flex', alignItems: 'flex-start', pointerEvents: 'auto', gap: 4 }}>
        <button
          ref={btnRef}
          className="action-button"
          type="button"
          onPointerDown={(e) => { e.stopPropagation(); /* avoid tree drag */ }}
          onPointerUp={(e) => { e.stopPropagation(); setOpenMenu(v => { const next = !v; if (!v) openAtButton(); return next; }); }}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenMenu(v => { const next = !v; if (!v) openAtButton(); return next; }); } }}
          draggable={false}
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={openMenu}
          title="More actions"
        >
          <span className="codicon codicon-kebab-vertical" />
        </button>
        {showExpand && (
          <button
            className="action-button"
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand?.(); } }}
            draggable={false}
            tabIndex={0}
            title={expanded ? 'Make inactive' : 'Make active'}
          >
            <span className={`codicon ${expanded ? 'codicon-circle-filled' : 'codicon-circle-outline'}`} />
          </button>
        )}
        {menu && ReactDOM.createPortal(menu, document.body)}
      </div>
    );
  };
  type FlowTypeWithCsv = FlowType | 'data';
  const renderInner = () => {
    switch (type as FlowTypeWithCsv) {
      case 'call':
        return (
          <TestCall
            value={stepData}
            imports={typeof testData?.import === 'object' ? (Object.fromEntries(Object.entries(testData.import).filter(([_, p]) => typeof p === 'string' && (p as string).endsWith('.mmt'))) as Record<string, string>) : undefined}
            onChange={callObj => onChange({ ...callObj })}
            placeholder="select a call"
          />
        );
  case 'data':
        return (
          <TestFlowCSV
            value={stepData}
            imports={typeof testData?.import === 'object' ? testData.import : undefined}
            onChange={(v) => onChange(v)}
          />
        );
      case 'check':
      case 'if':
      case 'assert': {
        let left = '?', op: CheckOps = '==' as CheckOps, right = '?';
        const match = stepData[type].split(' ');
        left = match[0];
        op = match[1] as CheckOps;
        right = match[2];
        return (
          <TestCheck
            left={left}
            op={op}
            right={right}
            onChange={({ left, op, right }) => onChange({ [type]: `${left} ${op} ${right}` })}
          />
        );
      }
      case 'for':
      case 'repeat':
        return (
          <input
            placeholder={type === 'for' ? '100, 10s, 5-10, i:data' : 'repeat count or duration'}
            value={stepData[type] || ''}
            onChange={e => onChange({ [type]: e.target.value })}
            style={{ width: 300 }}
          />
        );
      case 'js':
        return (
          <textarea
            placeholder="JavaScript code"
            value={stepData[type] || ''}
            onChange={e => onChange({ js: e.target.value })}
            style={{
              width: expanded ? '100%' : 300,
              height: expanded ? 400 : 24,
              resize: 'none',
              overflow: 'auto'
            }}
          />
        );
      case 'print':
        return (
          <textarea
            placeholder="Message to print"
            value={stepData[type] || ''}
            onChange={e => onChange({ print: e.target.value })}
            style={{
              width: expanded ? '100%' : 300,
              height: expanded ? 400 : 24,
              resize: 'none',
              overflow: 'auto'
            }}
          />
        );
      case 'set':
      case 'var':
      case 'const':
      case 'let':
        return (
          <TestFlowVar
            type={type as 'set' | 'var' | 'const' | 'let'}
            stepData={stepData}
            onChange={onChange}
          />
        );
      case 'steps':
      case 'stages':
        return null;
      case 'stage':
        return (
          <input
            placeholder="Stage name"
            value={stepData[type] || ''}
            onChange={e => onChange({ stage: e.target.value })}
            style={{ width: 300 }}
          />
        );
      default:
        return null;
    }
  };

  const containerStyle: React.CSSProperties | undefined =
    (type === 'set' || type === 'var' || type === 'const' || type === 'let')
      ? { gap: 8, width: '100%' }
      : undefined;

  return (
    <div className="test-flow-box-items" style={containerStyle}>
      <span
        style={{
          paddingTop: '6px',
          flex: '0 0 80px',
          width: 80,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {type}
      </span>
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {renderInner()}
      </div>
      <Actions />
    </div>
  );
};

export default TestFlowBox;