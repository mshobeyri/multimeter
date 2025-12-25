import React, {useMemo, useState} from 'react';

interface SuitePanelProps {
  content: string;
  setContent: (value: string) => void;
}

type SuiteTreeNode =
  | {kind: 'group'; id: string; label: string; children: SuiteTreeNode[]}
  | {kind: 'item'; id: string; label: string; path: string};

function safeParseYaml(raw: string): any {
  try {
    // mmtview already depends on mmt-core/markupConvertor for parsing;
    // but this panel keeps parsing minimal in v1.
    const lines = (raw || '').split('\n');
    const obj: any = {};
    // very small heuristic fallback; real validation happens in editor/extension.
    for (const line of lines) {
      if (line.startsWith('type:')) {
        obj.type = line.split(':').slice(1).join(':').trim();
      }
    }
    // Try to extract tests list crudely.
    const tests: string[] = [];
    let inTests = false;
    for (const line of lines) {
      if (/^tests\s*:\s*$/.test(line.trim())) {
        inTests = true;
        continue;
      }
      if (inTests) {
        const m = line.match(/^\s*-\s*(.+)\s*$/);
        if (m) {
          tests.push(m[1].trim());
          continue;
        }
        if (/^\S/.test(line)) {
          inTests = false;
        }
      }
    }
    obj.tests = tests;
    return obj;
  } catch {
    return null;
  }
}

function splitGroups(items: string[]): string[][] {
  const groups: string[][] = [];
  let cur: string[] = [];
  for (const raw of items || []) {
    const it = (raw || '').trim();
    if (!it) {
      continue;
    }
    if (it === 'then') {
      if (cur.length) {
        groups.push(cur);
      }
      cur = [];
      continue;
    }
    cur.push(it);
  }
  if (cur.length) {
    groups.push(cur);
  }
  return groups;
}

const SuitePanel: React.FC<SuitePanelProps> = ({content}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const tree = useMemo<SuiteTreeNode[]>(() => {
    const parsed = safeParseYaml(content);
    const tests: string[] = Array.isArray(parsed?.tests) ? parsed.tests : [];
    const groups = splitGroups(tests);
    return groups.map((g, idx) => {
      const groupId = `group-${idx + 1}`;
      return {
        kind: 'group',
        id: groupId,
        label: `Group ${idx + 1}`,
        children: g.map((p, j) => ({
          kind: 'item',
          id: `${groupId}-item-${j + 1}`,
          label: p,
          path: p,
        })),
      };
    });
  }, [content]);

  const toggle = (id: string) => {
    setExpanded(prev => ({...prev, [id]: !prev[id]}));
  };

  const renderNode = (node: SuiteTreeNode) => {
    if (node.kind === 'item') {
      return (
        <div key={node.id} style={{paddingLeft: 20, paddingTop: 4, paddingBottom: 4}}>
          <span style={{fontFamily: 'var(--vscode-editor-font-family)'}}>{node.label}</span>
        </div>
      );
    }

    const isOpen = expanded[node.id] ?? true;
    return (
      <div key={node.id} style={{paddingTop: 6}}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggle(node.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              toggle(node.id);
            }
          }}
          style={{
            cursor: 'pointer',
            userSelect: 'none',
            fontWeight: 600,
            padding: '6px 8px',
            background: 'var(--vscode-sideBar-background)',
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: 4,
          }}
        >
          {isOpen ? '▼' : '▶'} {node.label}
        </div>
        {isOpen ? <div>{node.children.map(renderNode)}</div> : null}
      </div>
    );
  };

  return (
    <div style={{padding: 12}}>
      <div style={{marginBottom: 8, fontWeight: 700}}>Suite</div>
      {tree.length === 0 ? (
        <div style={{opacity: 0.8}}>No suite items found under `tests:`</div>
      ) : (
        <div>{tree.map(renderNode)}</div>
      )}
    </div>
  );
};

export default SuitePanel;
