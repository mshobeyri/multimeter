import React from "react";
import ReactDOM from "react-dom";
import { FlowType, CheckOps } from "mmt-core/TestData";
import TestCheck from "./TestCheck";
import TestCall from "./TestCall";

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
  const parseLiteral = (text: string): any => {
    const t = (text ?? '').trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    if (/^(true|false)$/i.test(t)) {
      return /^true$/i.test(t);
    }
    if (/^-?\d+(?:\.\d+)?$/.test(t)) {
      const n = Number(t);
      if (!Number.isNaN(n)) return n;
    }
    return text;
  };
  const renderInner = () => {
    switch (type as FlowType) {
      case 'call':
        return (
          <TestCall
            value={stepData}
            imports={typeof testData?.import === 'object' ? testData.import : undefined}
            onChange={callObj => onChange({ ...callObj })}
            placeholder="select a call"
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
            style={{ width: 150 }}
          />
        );
      case 'js':
        return (
          <textarea
            placeholder="JavaScript code"
            value={stepData[type] || ''}
            onChange={e => onChange({ js: e.target.value })}
            style={{
              width: expanded ? '100%' : 200,
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
              width: expanded ? '100%' : 200,
              height: expanded ? 400 : 24,
              resize: 'none',
              overflow: 'auto'
            }}
          />
        );
      case 'set':
      case 'var':
      case 'const':
      case 'let': {
        const currentType = type as 'set' | 'var' | 'const' | 'let';
        const payload = (stepData && typeof stepData === 'object') ? stepData[currentType] : undefined;
        const key = payload && typeof payload === 'object' ? Object.keys(payload)[0] || '' : '';
        const valRaw = key ? (payload as any)[key] : '';
        const val = typeof valRaw === 'string' ? valRaw : (valRaw != null ? JSON.stringify(valRaw) : '');

        const handleKindChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
          const newKind = e.target.value as 'set' | 'var' | 'const' | 'let';
          const nextObj = key ? { [newKind]: { [key]: parseLiteral(val) } } : { [newKind]: {} } as any;
          onChange(nextObj);
        };
        const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const newKey = e.target.value;
          const nextPayload = newKey ? { [newKey]: parseLiteral(val) } : {};
          onChange({ [currentType]: nextPayload });
        };
        const handleValChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const newVal = e.target.value;
          const nextPayload = key ? { [key]: parseLiteral(newVal) } : {};
          onChange({ [currentType]: nextPayload });
        };

        return (
          <>
            <select value={currentType} onChange={handleKindChange} style={{ minWidth: 72 }}>
              <option value="set">set</option>
              <option value="var">var</option>
              <option value="const">const</option>
              <option value="let">let</option>
            </select>
            <input
              placeholder="property (e.g., outputs.name)"
              value={key}
              onChange={handleKeyChange}
              style={{ width: 100 }}
            />
            <input
              placeholder="value (e.g., user_info.name or 'text')"
              value={val}
              onChange={handleValChange}
              style={{ width: 100 }}
            />
          </>
        );
      }
      case 'steps':
      case 'stages':
        return null;
      case 'stage':
        return (
          <input
            placeholder="Stage name"
            value={stepData[type] || ''}
            onChange={e => onChange({ stage: e.target.value })}
            style={{ width: 150 }}
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