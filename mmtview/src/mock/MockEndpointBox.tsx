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
        className="popup-menu"
        style={{ left: menuPos.left, top: menuPos.top }}
        onClick={e => e.stopPropagation()}
      >
        <button type="button" role="menuitem" className="action-button menu-item"
          onPointerDown={e => e.stopPropagation()}
          onPointerUp={e => { e.stopPropagation(); setOpenMenu(false); onDuplicate?.(); }}
        >
          <span className="codicon codicon-copy" /> Duplicate
        </button>
        <button type="button" role="menuitem" className="action-button menu-item"
          onPointerDown={e => e.stopPropagation()}
          onPointerUp={e => { e.stopPropagation(); setOpenMenu(false); onRemove?.(); }}
        >
          <span className="codicon codicon-trash" /> Remove
        </button>
      </div>
    ) : null;

    return (
      <div className="actions-trail">
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
    <div className="test-flow-box-items is-center">
      <span
        className={`mock-ep-method-w${isFallback ? ' is-fallback' : ''}`}
        style={isFallback ? undefined : { color: methodTextColor(method) }}
      >
        {summaryLabel}
      </span>
      <div className="mock-ep-mid">
        <span className="mock-ep-path-text">
          {summaryPath}
        </span>
        {local.name && (
          <span className="mock-badge">
            {local.name}
          </span>
        )}
      </div>
      {!isFallback && local.match && <span className="mock-flag">match</span>}
      {!isFallback && local.reflect ? (
        <span className="mock-flag">reflect</span>
      ) : (
        <span className="mock-status">{local.status ?? 200}</span>
      )}
      {local.format && (
        <span className="mock-format">{local.format}</span>
      )}
      <Actions />
    </div>
  );

  if (!expanded) {
    return summary;
  }

  /* ─── Expanded editor ─── */
  return (
    <div className="mmt-fill">
      {summary}
      <div className="mock-form-stack">
        {/* Method */}
        {!isFallback && (
          <div className="mock-form-row">
            <span className="mock-form-label">Method</span>
            <select
              value={method}
              onChange={e => commitWith({ method: e.target.value as any })}
              className="mock-form-control"
            >
              {METHODS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </div>
        )}
        {/* Path */}
        {!isFallback && (
          <div className="mock-form-row">
            <span className="mock-form-label">Path</span>
            <input
              value={local.path || ''}
              onChange={e => setField({ path: e.target.value })}
              {...blurOrEnter}
              placeholder="/path/:param"
              className="mock-form-control"
            />
          </div>
        )}
        {/* Status */}
        <div className="mock-form-row">
          <span className="mock-form-label">Status</span>
          <input
            type="number"
            value={local.status ?? 200}
            onChange={e => setField({ status: parseInt(e.target.value, 10) || 200 })}
            {...blurOrEnter}
            min={100} max={599}
            className="mock-form-control"
          />
        </div>
        {/* Format */}
        <div className="mock-form-row">
          <span className="mock-form-label">Format</span>
          <select
            value={local.format || ''}
            onChange={e => commitWith({ format: (e.target.value || undefined) as any })}
            className="mock-form-control"
          >
            <option value="">auto</option>
            {FORMATS.map(f => <option key={f} value={f}>{getFormatLabel(f)}</option>)}
          </select>
        </div>
        {/* Name */}
        {!isFallback && (
          <div className="mock-form-row">
            <span className="mock-form-label">Name</span>
            <input
              value={local.name || ''}
              onChange={e => setField({ name: e.target.value || undefined })}
              {...blurOrEnter}
              placeholder="optional"
              className="mock-form-control"
            />
          </div>
        )}
        {/* Delay */}
        {!isFallback && (
          <div className="mock-form-row">
            <span className="mock-form-label">Delay</span>
            <input
              type="number"
              value={local.delay ?? ''}
              onChange={e => setField({ delay: parseInt(e.target.value, 10) || undefined })}
              {...blurOrEnter}
              min={0}
              placeholder="inherited"
              className="mock-form-control"
            />
            <span className="unit-suffix">ms</span>
          </div>
        )}
        {/* Reflect */}
        {!isFallback && (
          <div className="mock-form-row">
            <span className="mock-form-label">Reflect</span>
            <input
              type="checkbox"
              checked={!!local.reflect}
              onChange={e => commitWith({ reflect: e.target.checked || undefined })}
            />
          </div>
        )}
        {/* Body */}
        <div className="mock-form-row is-top">
          <span className="mock-form-label is-area">Body</span>
          <div className="field-grow">
            <textarea
              value={localBody}
              onChange={e => updateLocalBody(e.target.value)}
              onBlur={() => commit()}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) { (e.target as HTMLElement).blur(); } }}
              placeholder="Response body"
              className="mock-body"
            />
          </div>
        </div>
        {/* Headers */}
        <div className="mock-form-row is-top">
          <span className="mock-form-label is-headers">Headers</span>
          <div className="field-grow">
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
