import React, { useEffect, useRef, useState } from "react";

export interface ApiSelectorExample {
  id: string;
  title: string;
}

export interface ApiSelectorItem {
  id: string;
  title: string;
  method?: string;
  examples?: ApiSelectorExample[];
}

interface ApiSelectorProps {
  items: ApiSelectorItem[];
  value?: string;
  onChange: (id: string) => void;
  variant?: "header" | "method";
  onSaveItem?: (id: string) => void;
}

function findSelectorItem(items: ApiSelectorItem[], value?: string): {
  item: ApiSelectorItem;
  example?: ApiSelectorExample;
} | undefined {
  if (!items.length) {
    return undefined;
  }
  for (const item of items) {
    if (item.id === value) {
      return {item};
    }
    const example = (item.examples || []).find(child => child.id === value);
    if (example) {
      return {item, example};
    }
  }
  return {item: items[0]};
}

const ApiSelector: React.FC<ApiSelectorProps> = ({ items, value, onChange, variant = "header", onSaveItem }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selection = findSelectorItem(items, value);
  const selectedItem = selection?.item;
  const selectedExample = selection?.example;
  const label = selectedExample
    ? `${selectedItem?.title || "Select API"} · ${selectedExample.title}`
    : (selectedItem?.title || "Select API");
  const title = selectedItem
    ? `${(selectedItem.method || "").toUpperCase()} ${label}`
    : "Select API";

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`api-selector api-selector--${variant}`} ref={rootRef}>
      <button
        type="button"
        className={`api-selector-trigger${open ? " is-open" : ""}`}
        title={title}
        aria-label={title}
        aria-haspopup="tree"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        <span className="codicon codicon-list-tree" aria-hidden />
      </button>
      {open && (
        <div className="api-selector-menu" role="tree">
          {items.map(item => {
            const apiSelected = item.id === selectedItem?.id && !selectedExample;
            return (
              <div key={item.id} className="api-selector-group" role="group">
                <div className="api-selector-row">
                  <button
                    type="button"
                    role="treeitem"
                    aria-selected={apiSelected}
                    className={`api-selector-item${apiSelected ? " is-selected" : ""}`}
                    onClick={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                  >
                    <span className="api-selector-method">{(item.method || "api").toUpperCase()}</span>
                    <span className="api-selector-title">{item.title}</span>
                  </button>
                  {onSaveItem ? (
                    <button
                      type="button"
                      className="api-selector-save"
                      title="Save as MMT"
                      aria-label={`Save ${item.title} as MMT`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSaveItem(item.id);
                      }}
                    >
                      <span className="codicon codicon-save-as" aria-hidden />
                    </button>
                  ) : null}
                </div>
                {(item.examples || []).map(example => {
                  const exampleSelected = example.id === value;
                  return (
                    <div key={example.id} className="api-selector-row">
                      <button
                        type="button"
                        role="treeitem"
                        aria-selected={exampleSelected}
                        className={`api-selector-item is-child${exampleSelected ? " is-selected" : ""}`}
                        onClick={() => {
                          onChange(example.id);
                          setOpen(false);
                        }}
                      >
                        <span className="api-selector-method api-selector-example-icon" aria-hidden>
                          <span className="codicon codicon-lightbulb" />
                        </span>
                        <span className="api-selector-title">{example.title}</span>
                      </button>
                      {onSaveItem ? (
                        <button
                          type="button"
                          className="api-selector-save"
                          title="Save as MMT"
                          aria-label={`Save ${example.title} as MMT`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSaveItem(example.id);
                          }}
                        >
                          <span className="codicon codicon-save-as" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ApiSelector;
