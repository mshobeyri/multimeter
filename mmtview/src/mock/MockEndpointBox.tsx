import React from "react";
import ReactDOM from "react-dom";
import { MockEndpoint } from "mmt-core/MockData";
import KSVEditor from "../components/KSVEditor";
import { METHOD_PROTOCOL_COLORS, methodTextColor as sharedMethodTextColor } from '../shared/themeAccent';

interface MockEndpointBoxProps {
  endpoint: MockEndpoint;
  onChange: (value: MockEndpoint) => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
  expanded?: boolean;
  variant?: 'endpoint' | 'fallback';
}

const METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;
const FORMATS = ['json', 'xml', 'xmle', 'text', 'urlencoded'] as const;

function getFormatLabel(format: string): string {
  if (format === 'xml') {
    return 'xml — self-closing';
  }
  if (format === 'xmle') {
    return 'xmle — expanded';
  }
  if (format === 'urlencoded') {
    return 'urlencoded — form body';
  }
  return format;
}

export const METHOD_COLORS: Record<string, string> = {
  get: METHOD_PROTOCOL_COLORS.get,
  post: METHOD_PROTOCOL_COLORS.post,
  put: METHOD_PROTOCOL_COLORS.put,
  patch: METHOD_PROTOCOL_COLORS.patch,
  delete: METHOD_PROTOCOL_COLORS.delete,
  head: METHOD_PROTOCOL_COLORS.head,
  options: METHOD_PROTOCOL_COLORS.options,
};

/** Theme-harmonized text color for method labels/icons. */
export function methodTextColor(method: string): string {
  return sharedMethodTextColor(method);
}

const MockEndpointBox: React.FC<MockEndpointBoxProps> = ({
  endpoint, onChange, onDuplicate, onRemove, expanded, variant = 'endpoint',
}) => {
  /* ─── Local state: commit only on blur / Enter ─── */
  const bodyToStr = (b: any) =>
    typeof b === 'string' ? b : (b != null ? JSON.stringify(b, null, 2) : '');

  const [local, setLocal] = React.useState<MockEndpoint>(endpoint);
  const [localBody, setLocalBody] = React.useState(() => bodyToStr(endpoint.body));
  const localRef = React.useRef(local);
  const localBodyRef = React.useRef(localBody);
  localRef.current = local;
  localBodyRef.current = localBody;

  // Keep a stable ref to the latest onChange to avoid stale closures
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  // Sync from parent only when the actual data changes (not just object reference)
  const endpointJson = JSON.stringify(endpoint);
  const prevEndpointJson = React.useRef(endpointJson);
  React.useEffect(() => {
    if (endpointJson !== prevEndpointJson.current) {
      prevEndpointJson.current = endpointJson;
      setLocal(endpoint);
      setLocalBody(bodyToStr(endpoint.body));
    }
  }, [endpointJson]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = React.useCallback(() => {
    const ep = { ...localRef.current };
    const raw = localBodyRef.current;
    if (!raw) { ep.body = undefined; }
    else { try { ep.body = JSON.parse(raw); } catch { ep.body = raw; } }
    onChangeRef.current(ep);
  }, []);

  const commitWith = React.useCallback((patch: Partial<MockEndpoint>) => {
    const next = { ...localRef.current, ...patch };
    setLocal(next);
    localRef.current = next;
    const ep = { ...next };
    if (!('body' in patch)) {
      const raw = localBodyRef.current;
      if (!raw) { ep.body = undefined; }
      else { try { ep.body = JSON.parse(raw); } catch { ep.body = raw; } }
    }
    onChangeRef.current(ep);
  }, []);

  const setField = React.useCallback((patch: Partial<MockEndpoint>) => {
    const next = { ...localRef.current, ...patch };
    localRef.current = next;
    setLocal(next);
  }, []);

  const updateLocalBody = React.useCallback((raw: string) => {
    localBodyRef.current = raw;
    setLocalBody(raw);
  }, []);

  /** onBlur / onKeyDown helper for text inputs */
  const blurOrEnter = React.useMemo(() => ({
    onBlur: () => commit(),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        (e.target as HTMLElement).blur();
      }
    },
  }), [commit]);

  const method = String(typeof local.method === 'string' ? local.method : 'get').toLowerCase();
  const isFallback = variant === 'fallback';
  const summaryLabel = isFallback ? 'FALLBACK' : method.toUpperCase();
  const summaryPath = isFallback ? '/?' : (typeof local.path === 'string' ? local.path : String(local.path ?? ''));

  /* ─── Context menu (kebab) ─── */
  const Actions = () => {
    const btnRef = React.useRef<HTMLButtonElement | null>(null);
    const menuRef = React.useRef<HTMLDivElement | null>(null);
    const [menuPos, setMenuPos] = React.useState<{ left: number; top: number } | null>(null);
    const [openMenu, setOpenMenu] = React.useState(false);

    const openAtButton = () => {
      const el = btnRef.current;
      if (!el) { return; }
      const rect = el.getBoundingClientRect();
      setMenuPos({ left: Math.max(8, rect.right - 160), top: rect.bottom + 4 });
    };

    React.useEffect(() => {
      if (!openMenu) { return; }
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target;
        if (!target) { return; }
        if (menuRef.current?.contains(target as Node)) { return; }
        if (btnRef.current?.contains(target as Node)) { return; }
        setOpenMenu(false);
      };
      const handleScrollOrResize = () => setOpenMenu(false);
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
        style={{
          position: 'fixed', left: menuPos.left, top: menuPos.top, zIndex: 1000,
          background: 'var(--vscode-editorWidget-background,#232323)',
          border: '1px solid var(--vscode-editorWidget-border,#333)',
          borderRadius: 4, boxShadow: '0 2px 6px rgba(0,0,0,0.4)', minWidth: 200,
        }}
        onClick={e => e.stopPropagation()}
      >
        <button type="button" role="menuitem" className="action-button"
          style={{ width: '100%', justifyContent: 'flex-start' }}
          onPointerDown={e => e.stopPropagation()}
          onPointerUp={e => { e.stopPropagation(); setOpenMenu(false); onDuplicate?.(); }}
        >
          <span className="codicon codicon-copy" /> Duplicate
        </button>
        <button type="button" role="menuitem" className="action-button"
          style={{ width: '100%', justifyContent: 'flex-start' }}
          onPointerDown={e => e.stopPropagation()}
          onPointerUp={e => { e.stopPropagation(); setOpenMenu(false); onRemove?.(); }}
        >
          <span className="codicon codicon-trash" /> Remove
        </button>
      </div>
    ) : null;

    return (
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-start', pointerEvents: 'auto', gap: 0 }}>
        {(onDuplicate || onRemove) && (
          <button ref={btnRef} className="action-button" type="button"
            onPointerDown={e => e.stopPropagation()}
            onPointerUp={e => { e.stopPropagation(); setOpenMenu(v => { if (!v) { openAtButton(); } return !v; }); }}
            draggable={false} tabIndex={0} aria-haspopup="menu" aria-expanded={openMenu} title="More actions"
          >
            <span className="codicon codicon-kebab-vertical" />
          </button>
        )}
        {menu && ReactDOM.createPortal(menu, document.body)}
      </div>
    );
  };

  /* ─── Collapsed summary row ─── */
  const summary = (
    <div className="test-flow-box-items" style={{ alignItems: 'center' }}>
      <span style={{ flex: `0 1 ${isFallback ? 76 : 60}px`, maxWidth: isFallback ? 76 : 60, minWidth: 0, fontWeight: 700, fontSize: 12, color: isFallback ? 'var(--vscode-descriptionForeground)' : methodTextColor(method) }}>
        {summaryLabel}
      </span>
      <div style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, fontFamily: 'var(--vscode-editor-font-family, monospace)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {summaryPath}
        </span>
        {local.name && (
          <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, backgroundColor: 'var(--vscode-badge-background)', color: 'var(--vscode-badge-foreground)', whiteSpace: 'nowrap' }}>
            {local.name}
          </span>
        )}
      </div>
      {!isFallback && local.match && <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--vscode-descriptionForeground)' }}>match</span>}
      {!isFallback && local.reflect ? (
        <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--vscode-descriptionForeground)' }}>reflect</span>
      ) : (
        <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, minWidth: 28, textAlign: 'right' }}>{local.status ?? 200}</span>
      )}
      {local.format && (
        <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', minWidth: 28, textAlign: 'right' }}>{local.format}</span>
      )}
      <Actions />
    </div>
  );

  if (!expanded) {
    return summary;
  }

  /* ─── Expanded editor ─── */
  return (
    <div style={{ width: '100%' }}>
      {summary}
      <div style={{ padding: '8px 0 4px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Method */}
        {!isFallback && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', width: 56, flexShrink: 0 }}>Method</span>
            <select
              value={method}
              onChange={e => commitWith({ method: e.target.value as any })}
              style={{ flex: 1, padding: '4px 6px' }}
            >
              {METHODS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </div>
        )}
        {/* Path */}
        {!isFallback && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', width: 56, flexShrink: 0 }}>Path</span>
            <input
              value={local.path || ''}
              onChange={e => setField({ path: e.target.value })}
              {...blurOrEnter}
              placeholder="/path/:param"
              style={{ flex: 1, width: '100%' }}
            />
          </div>
        )}
        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', width: 56, flexShrink: 0 }}>Status</span>
          <input
            type="number"
            value={local.status ?? 200}
            onChange={e => setField({ status: parseInt(e.target.value, 10) || 200 })}
            {...blurOrEnter}
            min={100} max={599}
            style={{ flex: 1, width: '100%' }}
          />
        </div>
        {/* Format */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', width: 56, flexShrink: 0 }}>Format</span>
          <select
            value={local.format || ''}
            onChange={e => commitWith({ format: (e.target.value || undefined) as any })}
            style={{ flex: 1, padding: '4px 6px' }}
          >
            <option value="">auto</option>
            {FORMATS.map(f => <option key={f} value={f}>{getFormatLabel(f)}</option>)}
          </select>
        </div>
        {/* Name */}
        {!isFallback && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', width: 56, flexShrink: 0 }}>Name</span>
            <input
              value={local.name || ''}
              onChange={e => setField({ name: e.target.value || undefined })}
              {...blurOrEnter}
              placeholder="optional"
              style={{ flex: 1, width: '100%' }}
            />
          </div>
        )}
        {/* Delay */}
        {!isFallback && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', width: 56, flexShrink: 0 }}>Delay</span>
            <input
              type="number"
              value={local.delay ?? ''}
              onChange={e => setField({ delay: parseInt(e.target.value, 10) || undefined })}
              {...blurOrEnter}
              min={0}
              placeholder="inherited"
              style={{ flex: 1, width: '100%' }}
            />
            <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)' }}>ms</span>
          </div>
        )}
        {/* Reflect */}
        {!isFallback && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', width: 56, flexShrink: 0 }}>Reflect</span>
            <input
              type="checkbox"
              checked={!!local.reflect}
              onChange={e => commitWith({ reflect: e.target.checked || undefined })}
            />
          </div>
        )}
        {/* Body */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', width: 56, flexShrink: 0, paddingTop: 4 }}>Body</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <textarea
              value={localBody}
              onChange={e => updateLocalBody(e.target.value)}
              onBlur={() => commit()}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) { (e.target as HTMLElement).blur(); } }}
              placeholder="Response body"
              style={{
                width: '100%', height: 120, resize: 'vertical', overflow: 'auto',
                fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 12,
              }}
            />
          </div>
        </div>
        {/* Headers */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', width: 56, flexShrink: 0, height: 30, lineHeight: '30px' }}>Headers</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <KSVEditor
              label=""
              value={local.headers}
              onChange={kv => {
                const cleaned = Object.fromEntries(Object.entries(kv).filter(([k]) => k.trim()));
                commitWith({ headers: Object.keys(cleaned).length > 0 ? cleaned : undefined });
              }}
              keyPlaceholder="Header"
              valuePlaceholder="value"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MockEndpointBox;
