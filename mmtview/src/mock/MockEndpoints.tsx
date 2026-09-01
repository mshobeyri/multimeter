import React from "react";
import { MockData, MockEndpoint } from "mmt-core/MockData";
import MockEndpointBox, { methodTextColor } from "./MockEndpointBox";
import { ControlledTreeEnvironment, Tree, DraggingPosition, DraggingPositionBetweenItems } from 'react-complex-tree';
import { patchMockYaml } from "./mockYaml";
import PrimaryButton from "../components/PrimaryButton";

// Transparent drag image to remove native ghost preview while preserving drop lines
let dragPreviewEl: HTMLDivElement | null = null;
function setTransparentDragImage(dt: DataTransfer | null | undefined) {
    if (!dt) return;
    try {
        const el = document.createElement('div');
        el.setAttribute('aria-hidden', 'true');
        Object.assign(el.style, {
            position: 'fixed', top: '-10000px', left: '-10000px',
            width: '1px', height: '1px', opacity: '0', pointerEvents: 'none',
        } as Partial<CSSStyleDeclaration>);
        document.body.appendChild(el);
        dragPreviewEl = el;
        dt.setDragImage(el, 0, 0);
    } catch { }
}

const methodIconFor = (method: string): string => {
  switch (method.toLowerCase()) {
    case 'get': return 'codicon-arrow-down';
    case 'post': return 'codicon-arrow-up';
    case 'put': return 'codicon-arrow-swap';
    case 'patch': return 'codicon-edit';
    case 'delete': return 'codicon-trash';
    case 'head': return 'codicon-eye';
    case 'options': return 'codicon-settings-gear';
    default: return 'codicon-globe';
  }
};

interface MockEndpointsProps {
  content: string;
  setContent: (value: string) => void;
  mockData: MockData;
}

/* ─── Tree helpers ─── */

function endpointsToTree(endpoints: MockEndpoint[]): { items: Record<string, any> } {
  const items: Record<string, any> = {};
  const topChildren: string[] = [];

  endpoints.forEach((ep, i) => {
    const key = `ep_${i}`;
    topChildren.push(key);
    items[key] = {
      index: key,
      isFolder: false,
      children: [],
      data: JSON.stringify(ep),
    };
  });

  items.root = {
    index: 'root',
    isFolder: true,
    children: topChildren,
    data: 'root',
  };

  return { items };
}

function treeToEndpoints(items: Record<string, any>): MockEndpoint[] {
  const root = items.root;
  if (!root) { return []; }
  const order: string[] = Array.isArray(root.children) ? root.children : [];
  return order.map(key => {
    const node = items[key];
    if (!node) { return { path: '/' } as MockEndpoint; }
    try {
      return JSON.parse(node.data) as MockEndpoint;
    } catch {
      return { path: '/' } as MockEndpoint;
    }
  });
}

const MockEndpoints: React.FC<MockEndpointsProps> = ({ content, setContent, mockData }) => {
  const endpoints = (mockData.endpoints || []) as MockEndpoint[];
  const [shortTree, setShortTree] = React.useState(() => endpointsToTree(endpoints));

  /* ─── Fallback helpers ─── */
  const updateFallback = React.useCallback((fallbackEndpoint: MockEndpoint) => {
    try {
      const fallback: Record<string, any> = {};
      fallback.status = fallbackEndpoint.status ?? 404;
      if (fallbackEndpoint.format) { fallback.format = fallbackEndpoint.format; }
      if (fallbackEndpoint.headers && Object.keys(fallbackEndpoint.headers).length > 0) { fallback.headers = fallbackEndpoint.headers; }
      if (fallbackEndpoint.body !== undefined && fallbackEndpoint.body !== null && fallbackEndpoint.body !== '') { fallback.body = fallbackEndpoint.body; }
      setContent(patchMockYaml(content, { fallback } as Partial<MockData>));
    } catch { /* ignore */ }
  }, [content, setContent]);
  const contentRef = React.useRef(content);
  contentRef.current = content;
  const internalChangeRef = React.useRef(false);
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);
  const [openEditors, setOpenEditors] = React.useState<Record<string, boolean>>({});
  const [fallbackOpen, setFallbackOpen] = React.useState(false);
  const [addMenuOpen, setAddMenuOpen] = React.useState(false);
  const addBtnRef = React.useRef<HTMLButtonElement | null>(null);

  /* Sync tree when external data changes (skip when change was from our own commit) */
  React.useEffect(() => {
    if (internalChangeRef.current) {
      internalChangeRef.current = false;
      return;
    }
    const newTree = endpointsToTree(endpoints);
    setShortTree(newTree);
    setExpandedItems(prev => {
      const allIds = new Set(Object.values(newTree.items).map((it: any) => String(it.index)));
      return prev.filter(id => allIds.has(id));
    });
    setOpenEditors(prev => {
      const allIds = new Set(Object.values(newTree.items).map((it: any) => String(it.index)));
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(prev)) {
        if (allIds.has(k)) { next[k] = prev[k]; }
      }
      return next;
    });
  }, [endpoints.length, content]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Close add menu on outside click */
  React.useEffect(() => {
    if (!addMenuOpen) { return; }
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (addBtnRef.current && addBtnRef.current.contains(t as Node)) { return; }
      setAddMenuOpen(false);
    };
    document.addEventListener('click', onDocDown, true);
    window.addEventListener('resize', () => setAddMenuOpen(false), { once: true });
    return () => document.removeEventListener('click', onDocDown, true);
  }, [addMenuOpen]);

  /* ─── Persist tree → YAML ─── */
  const commitEndpoints = React.useCallback((items: Record<string, any>) => {
    try {
      const newEndpoints = treeToEndpoints(items);
      internalChangeRef.current = true;
      setContent(patchMockYaml(contentRef.current, { endpoints: newEndpoints }));
    } catch (e) {
      console.error('Failed to commit endpoints:', e);
    }
  }, [setContent]);

  /* ─── Add endpoint ─── */
  const METHODS_TO_ADD = ['get', 'post', 'put', 'delete', 'patch'] as const;

  const addEndpoint = (method: string) => {
    const itemsCopy = { ...shortTree.items } as Record<string, any>;
    let key = `ep_${Date.now().toString(36)}`;
    while (itemsCopy[key]) { key = `ep_${Math.random().toString(36).slice(2, 8)}`; }
    const newEp: MockEndpoint = { method: method as any, path: '/new', status: 200 };
    itemsCopy[key] = {
      index: key,
      isFolder: false,
      children: [],
      data: JSON.stringify(newEp),
    };
    const parent = itemsCopy.root;
    const children: string[] = Array.isArray(parent.children) ? [...parent.children] : [];
    children.push(key);
    itemsCopy.root = { ...parent, children };
    setShortTree({ items: itemsCopy });
    commitEndpoints(itemsCopy);
    // auto-expand the new endpoint
    setOpenEditors(prev => ({ ...prev, [key]: true }));
  };

  /* ─── Tree helpers for duplicate/remove ─── */
  const doDuplicate = (targetKey: string) => {
    setShortTree(prev => {
      const itemsCopy = { ...prev.items } as Record<string, any>;
      const src = itemsCopy[targetKey];
      if (!src) { return prev; }
      let newKey = `ep_${Math.random().toString(36).slice(2, 8)}`;
      while (itemsCopy[newKey]) { newKey = `ep_${Math.random().toString(36).slice(2, 8)}`; }
      itemsCopy[newKey] = { ...src, index: newKey };

      const parentKey = Object.keys(itemsCopy).find(pk => Array.isArray(itemsCopy[pk].children) && itemsCopy[pk].children.includes(targetKey)) || 'root';
      const parent = itemsCopy[parentKey];
      const children: string[] = Array.isArray(parent.children) ? [...parent.children] : [];
      const idx = children.indexOf(targetKey);
      const insertIdx = idx >= 0 ? idx + 1 : children.length;
      children.splice(insertIdx, 0, newKey);
      itemsCopy[parentKey] = { ...parent, children };

      commitEndpoints(itemsCopy);
      return { items: itemsCopy };
    });
  };

  const doRemove = (targetKey: string) => {
    if (targetKey === 'root') { return; }
    setShortTree(prev => {
      const itemsCopy = { ...prev.items } as Record<string, any>;
      const parentKey = Object.keys(itemsCopy).find(pk => Array.isArray(itemsCopy[pk].children) && itemsCopy[pk].children.includes(targetKey)) || 'root';
      const parent = itemsCopy[parentKey];
      const children: string[] = Array.isArray(parent.children) ? [...parent.children] : [];
      const idx = children.indexOf(targetKey);
      if (idx >= 0) { children.splice(idx, 1); }
      itemsCopy[parentKey] = { ...parent, children };
      delete itemsCopy[targetKey];

      commitEndpoints(itemsCopy);
      return { items: itemsCopy };
    });
  };

  /* ─── Drag & drop ─── */
  const handleDrop = (draggedItems: any[], target: DraggingPosition) => {
    if (!Array.isArray(draggedItems) || draggedItems.length === 0) { return; }
    const itemsCopy = { ...shortTree.items } as Record<string, any>;

    const removeDraggedFromParent = (index: string) => {
      const parentKey = Object.keys(itemsCopy).find(key =>
        itemsCopy[key].children?.includes(index)
      );
      if (parentKey) {
        const newChildren = itemsCopy[parentKey].children.filter((c: string) => c !== index);
        itemsCopy[parentKey] = { ...itemsCopy[parentKey], children: newChildren };
      }
    };

    draggedItems.forEach(di => removeDraggedFromParent(di.index));

    if (target.targetType === 'between-items') {
      const t = target as DraggingPositionBetweenItems;
      const parentKey = t.parentItem;
      const siblings = itemsCopy[parentKey].children;
      const childIndex = t.childIndex;
      const originalSiblings: string[] = (shortTree.items[parentKey]?.children) || [];
      const removedBefore = draggedItems.reduce((acc, di) => {
        const wasSameParent = originalSiblings.includes(di.index);
        if (wasSameParent) {
          const origIdx = originalSiblings.indexOf(di.index);
          if (origIdx >= 0 && origIdx < childIndex) { return acc + 1; }
        }
        return acc;
      }, 0);
      const insertIdx = Math.max(0, Math.min(childIndex - removedBefore, siblings.length));
      const newChildren = [
        ...siblings.slice(0, insertIdx),
        ...draggedItems.map(di => di.index),
        ...siblings.slice(insertIdx),
      ];
      itemsCopy[parentKey] = { ...itemsCopy[parentKey], children: newChildren };
    } else if (target.targetType === 'root') {
      const siblings = itemsCopy.root.children;
      const newChildren = [...siblings, ...draggedItems.map(di => di.index)];
      itemsCopy.root = { ...itemsCopy.root, children: newChildren };
    }

    setShortTree({ items: itemsCopy });
    commitEndpoints(itemsCopy);

    // Collapse dragged items after move
    setOpenEditors(prev => {
      const next = { ...prev } as Record<string, boolean>;
      draggedItems.forEach(di => { delete next[String(di.index)]; });
      return next;
    });
  };

  /* ─── NoTreeInterference wrapper ─── */
  const stopAll = (e: React.SyntheticEvent) => { e.stopPropagation(); };

  const NoTreeInterference: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div
      onMouseDownCapture={stopAll}
      onFocusCapture={stopAll}
      onKeyDown={stopAll}
      onKeyUp={stopAll}
      onInputCapture={stopAll}
      style={{ flex: 1, minWidth: 0 }}
    >
      {children}
    </div>
  );

  return (
    <div className="test-flow-tree" style={{ padding: '0 16px 16px', boxSizing: 'border-box' }}>
      {/* Endpoints header */}
      <div className="label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'visible' }}>
        <span>Endpoints</span>
        <PrimaryButton
          ref={addBtnRef}
          icon="add"
          onPointerDown={e => e.stopPropagation()}
          onPointerUp={e => { e.stopPropagation(); setAddMenuOpen(v => !v); }}
          title="Add endpoint"
        >
          Add endpoint
        </PrimaryButton>
        {addMenuOpen && (
          <div
            style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 1000,
              background: 'var(--vscode-editorWidget-background,#232323)',
              border: '1px solid var(--vscode-editorWidget-border,#333)',
              borderRadius: 4, boxShadow: '0 2px 6px rgba(0,0,0,0.4)', minWidth: 200,
            }}
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            {METHODS_TO_ADD.map(m => (
              <button
                key={m}
                className="action-button"
                style={{ width: '100%', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}
                onPointerUp={() => { setAddMenuOpen(false); addEndpoint(m); }}
              >
                <span className={`codicon ${methodIconFor(m)}`} style={{ fontSize: 14, opacity: 0.85, color: methodTextColor(m) }} aria-hidden />
                <span style={{ fontWeight: 600 }}>{m.toUpperCase()}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tree */}
      <ControlledTreeEnvironment
        items={shortTree.items}
        getItemTitle={item => item.data}
        canSearch={false}
        canSearchByStartingTyping={false}
        viewState={{ 'mock-tree': { expandedItems } }}
        onExpandItem={(item, treeId) => {
          if (treeId !== 'mock-tree') { return; }
          setExpandedItems(prev => prev.includes(item.index as string) ? prev : [...prev, item.index as string]);
        }}
        onCollapseItem={(item, treeId) => {
          if (treeId !== 'mock-tree') { return; }
          setExpandedItems(prev => prev.filter(i => i !== item.index));
        }}
        canDragAndDrop={true}
        canDropOnFolder={false}
        canReorderItems={true}
        onDrop={handleDrop}
        onSelectItems={() => { }}
        renderItemArrow={({ item }) => {
          let ep: MockEndpoint | undefined;
          try { ep = JSON.parse(item.data as string); } catch { }
          const method = String(typeof ep?.method === 'string' ? ep.method : 'get').toLowerCase();
          const ico = methodIconFor(method);
          return (
            <span
              style={{ display: 'inline-flex', alignSelf: 'center', width: 16, justifyContent: 'center' }}
              aria-hidden
            >
              <span className={`codicon ${ico}`} style={{ fontSize: 14, opacity: 0.8, color: methodTextColor(method) }} />
            </span>
          );
        }}
        renderItem={({ title, arrow, context, item, children }) => {
          if (!title) { return null; }

          let ep: MockEndpoint = { path: '/' };
          try { ep = JSON.parse(title as string); } catch { }

          const isOpen = !!openEditors[String(item.index)];

          return (
            <div
              {...context.itemContainerWithChildrenProps}
              onDragStart={(e) => {
                const key = String(item.index);
                setOpenEditors(prev => (prev[key] ? { ...prev, [key]: false } : prev));
                setTransparentDragImage(e.dataTransfer);
              }}
              onDragEnd={() => {
                if (dragPreviewEl && dragPreviewEl.parentNode) {
                  (dragPreviewEl.parentNode as Node).removeChild(dragPreviewEl);
                }
                dragPreviewEl = null;
              }}
            >
              <div
                className={`tree-view-box${isOpen ? ' active' : ''}`}
                {...context.itemContainerWithoutChildrenProps}
                style={{ alignItems: 'flex-start' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', height: 32, flexShrink: 0 }}>
                  <button
                    className="action-button"
                    type="button"
                    title={isOpen ? 'Collapse box' : 'Expand box'}
                    aria-label={isOpen ? 'Collapse box' : 'Expand box'}
                    onPointerDown={e => e.stopPropagation()}
                    onPointerUp={e => {
                      e.stopPropagation();
                      setOpenEditors(prev => ({ ...prev, [String(item.index)]: !prev[String(item.index)] }));
                    }}
                    draggable={false}
                    tabIndex={0}
                    style={{
                      display: 'inline-flex',
                      width: 24,
                      minWidth: 24,
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      className={`codicon ${isOpen ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
                      style={{ fontSize: 16 }}
                    />
                  </button>
                  {arrow}
                </div>
                <NoTreeInterference>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <MockEndpointBox
                      endpoint={ep}
                      onChange={newEp => {
                        setShortTree(prev => {
                          const itemsCopy = { ...prev.items } as Record<string, any>;
                          const cur = itemsCopy[item.index];
                          if (cur) {
                            itemsCopy[item.index] = { ...cur, data: JSON.stringify(newEp) };
                          }
                          commitEndpoints(itemsCopy);
                          return { items: itemsCopy };
                        });
                      }}
                      expanded={isOpen}
                      onDuplicate={() => doDuplicate(String(item.index))}
                      onRemove={() => doRemove(String(item.index))}
                    />
                  </div>
                </NoTreeInterference>
                <span
                  {...context.interactiveElementProps}
                  title="Drag to reorder"
                  onMouseDownCapture={(e) => e.stopPropagation()}
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, minWidth: 24, height: 24, marginTop: 4,
                    opacity: 0.7, cursor: 'grab', userSelect: 'none',
                  }}
                >
                  <span className="codicon codicon-gripper" aria-hidden />
                </span>
              </div>
              {children}
            </div>
          );
        }}
        renderTreeContainer={({ children, containerProps }) => <div {...containerProps}>{children}</div>}
        renderItemsContainer={({ children, containerProps }) => <ul {...containerProps} style={{ ...(containerProps.style || {}), margin: 0, padding: 0, listStyle: 'none' }}>{children}</ul>}
        renderDragBetweenLine={({ lineProps }) => (
          <div {...lineProps} style={{ background: 'var(--vscode-focusBorder, #264f78)', height: '1px' }} />
        )}
      >
        <Tree treeId="mock-tree" rootItem="root" treeLabel="Mock Endpoints" />
      </ControlledTreeEnvironment>

      <div className={`tree-view-box mock-fallback-editor${fallbackOpen ? ' active' : ''}`} style={{ alignItems: 'flex-start', marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 32, flexShrink: 0 }}>
          <button
            className="action-button"
            type="button"
            title={fallbackOpen ? 'Collapse box' : 'Expand box'}
            aria-label={fallbackOpen ? 'Collapse box' : 'Expand box'}
            onPointerDown={e => e.stopPropagation()}
            onPointerUp={e => {
              e.stopPropagation();
              setFallbackOpen(value => !value);
            }}
            draggable={false}
            tabIndex={0}
            style={{
              display: 'inline-flex',
              width: 24,
              minWidth: 24,
              justifyContent: 'center',
            }}
          >
            <span
              className={`codicon ${fallbackOpen ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
              style={{ fontSize: 16 }}
            />
          </button>
          <span style={{ display: 'inline-flex', alignSelf: 'center', width: 16, justifyContent: 'center' }} aria-hidden>
            <span className="codicon codicon-circle-slash" style={{ fontSize: 14, opacity: 0.8, color: 'var(--vscode-descriptionForeground)' }} />
          </span>
        </div>
        <NoTreeInterference>
          <div style={{ flex: 1, minWidth: 0 }}>
            <MockEndpointBox
              endpoint={{
                path: '/?',
                status: mockData.fallback?.status ?? 404,
                format: mockData.fallback?.format,
                headers: mockData.fallback?.headers,
                body: mockData.fallback?.body,
              }}
              onChange={updateFallback}
              expanded={fallbackOpen}
              variant="fallback"
            />
          </div>
        </NoTreeInterference>
      </div>
    </div>
  );
};

export default MockEndpoints;
