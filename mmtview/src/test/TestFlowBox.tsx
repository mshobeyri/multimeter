import React from "react";
import ReactDOM from "react-dom";
import { FlowType, CheckOps } from "mmt-core/TestData";
import TestCheck from "./TestCheck";
import TestCall from "./TestCall";
import TestFlowVar from "./TestFlowVar";
import TestFlowCSV from "./TestFlowCSV";
import { type MissingImportEntry } from "../text/validator";
import TestIf from "./TestIf";

interface TestFlowBoxProps {
  data: any,
  onChange: (value: any) => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
  showExpand?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  importValidation?: {
    missingImports: MissingImportEntry[];
    inputsByAlias: Record<string, string[]>;
  };
}

const TestFlowBox: React.FC<TestFlowBoxProps> = ({ data, onChange, onDuplicate, onRemove, showExpand, expanded, onToggleExpand, importValidation }) => {
  const { type, stepData, testData } = data;

  const Actions = () => {
    const btnRef = React.useRef<HTMLButtonElement | null>(null);
    const menuRef = React.useRef<HTMLDivElement | null>(null);
    const [menuPos, setMenuPos] = React.useState<{ left: number; top: number } | null>(null);
    const [openMenu, setOpenMenu] = React.useState(false);

    const openAtButton = () => {
      const el = btnRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuPos({ left: Math.max(8, rect.right - 160), top: rect.bottom + 4 });
    };

    React.useEffect(() => {
      if (!openMenu) return;

      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target;
        if (!target) return;
        if (menuRef.current?.contains(target as Node)) return;
        if (btnRef.current?.contains(target as Node)) return;
        setOpenMenu(false);
      };

      const handleScrollOrResize = () => {
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
        style={{ position: 'fixed', left: menuPos.left, top: menuPos.top, zIndex: 1000, background: 'var(--vscode-editorWidget-background,#232323)', border: '1px solid var(--vscode-editorWidget-border,#333)', borderRadius: 4, boxShadow: '0 2px 6px rgba(0,0,0,0.4)', minWidth: 200 }}
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
          <span className={`codicon codicon-copy`} ></span>
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
          <span className={`codicon codicon-trash`}></span>
          Remove
        </button>
      </div>
    ) : null;

    return (
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-start', pointerEvents: 'auto', gap: 0 }}>
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
            title={expanded ? 'Collapse box' : 'Expand box'}
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
            missingImports={importValidation?.missingImports}
            importedInputsByAlias={importValidation?.inputsByAlias}
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
      case 'if': {
        let actual = '', op: CheckOps = '==' as CheckOps, expected = '';
        const raw = (stepData && typeof stepData[type] === 'string') ? (stepData[type] as string) : '';
        const match = raw.trim().length ? raw.trim().split(/\s+/) : [] as string[];
        actual = match[0] ?? '';
        op = (match[1] as CheckOps) ?? '==';
        expected = match[2] ?? '';
        return (
          <TestIf
            actual={actual}
            op={op}
            expected={expected}
            onChange={({ actual, op, expected }) => onChange({ [type]: `${actual} ${op} ${expected}` })}
          />
        );
      }
      case 'check':
      case 'assert': {
        let actual = '', op: CheckOps = '==' as CheckOps, expected = '', title = '', details = '', report_success = false;
        const rawVal = stepData && stepData[type];
        if (typeof rawVal === 'string') {
          const match = rawVal.trim().length ? rawVal.trim().split(/\s+/) : [] as string[];
          actual = match[0] ?? '';
          op = (match[1] as CheckOps) ?? '==';
          expected = match[2] ?? '';
        } else if (rawVal && typeof rawVal === 'object') {
          actual = (rawVal as any).actual ?? '';
          expected = (rawVal as any).expected ?? '';
          op = ((rawVal as any).operator || '==') as CheckOps;
          title = (rawVal as any).title || '';
          details = (rawVal as any).details || '';
          report_success = Boolean((rawVal as any).report_success);
        }
        return (
          <TestCheck
              value={{ actual, op, expected, title, details, report_success }}
              onChange={({ actual, op, expected, title, details, report_success }) => {
                const obj: any = { actual, expected, operator: op || '==', };
              if (title.trim().length > 0) {
                obj.title = title.trim();
              }
              if (details.trim().length > 0) {
                obj.details = details.trim();
              }
              if (report_success) {
                obj.report_success = true;
              }
              onChange({ [type]: obj });
            }}
          />
        );
      }
      case 'for':
      case 'repeat':
      case 'delay':
        return (
          <input
            placeholder={type === 'for' ? '(i = 0; i < 5; i++ | key in obj | item of list)' : (type === 'delay' ? '(1ms | 2s | 3m | 4h)' : '(100 | 2ms | 3m | 4h)')}
            value={stepData[type] || ''}
            onChange={e => onChange({ [type]: e.target.value })}
            style={{ width: '100%' }}
          />
        );
      case 'js':
        return (
          <textarea
            placeholder="JavaScript code"
            value={stepData[type] || ''}
            onChange={e => onChange({ js: e.target.value })}
            style={{
              width: '100%',
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
              width: '100%',
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
      case 'stage': {
        const idVal = typeof stepData?.id === 'string' ? stepData.id : '';
        const condVal = typeof stepData?.condition === 'string' ? stepData.condition : '';
        const deps = Array.isArray(stepData?.depends_on)
          ? stepData.depends_on as string[]
          : (stepData?.depends_on ? [String(stepData.depends_on)] : []);
        const depsStr = deps.join(', ');
        const updateStage = (patch: Partial<{ id: string; condition: string; depends_on: string[] }>) => {
          const next = { ...(stepData || {}), ...patch } as any;
          onChange(next);
        };
        return (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              placeholder="id"
              value={idVal}
              onChange={e => updateStage({ id: e.target.value })}
              style={{ minWidth: 80, flex: '0 0 120px' }}
            />
            <input
              placeholder="condition"
              value={condVal}
              onChange={e => updateStage({ condition: e.target.value })}
              style={{ minWidth: 120, flex: '1 1 40%' }}
            />
            <input
              placeholder="depends_on"
              value={depsStr}
              onChange={e => updateStage({ depends_on: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              style={{ minWidth: 140, flex: '1 1 40%' }}
            />
          </div>
        );
      }
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
          flex: '0 1 80px',
          maxWidth: 80,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {type}
      </span>
      <div
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          overflow: 'hidden'
        }}
      >
        {renderInner()}
      </div>
      <div
        style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-start', pointerEvents: 'auto', gap: 4, flex: '0 0 auto' }}
      >
        <Actions />
      </div>
    </div>
  );
};

export default TestFlowBox;