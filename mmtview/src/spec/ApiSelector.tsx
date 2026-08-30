import React, { useEffect, useRef, useState } from "react";
import { SpecApiItem, findSpecApiSelection } from "mmt-core/importConvertor";
import { HeaderAction } from "../components/PanelRunHeader";

interface ApiSelectorProps {
  items: SpecApiItem[];
  value?: string;
  onChange: (id: string) => void;
}

const ApiSelector: React.FC<ApiSelectorProps> = ({ items, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selection = findSpecApiSelection(items, value);
  const selectedItem = selection?.item;
  const selectedExample = selectedItem?.examples.find(
    example => example.exampleIndex === selection?.exampleIndex
  );
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
    <div className="api-selector" ref={rootRef}>
      <HeaderAction
        icon="list-tree"
        label={label}
        title={title}
        onClick={() => setOpen(current => !current)}
      />
      {open && (
        <div className="api-selector-menu" role="tree">
          {items.map(item => {
            const apiSelected = item.id === selectedItem?.id && (selection?.exampleIndex ?? -1) < 0;
            return (
              <div key={item.id} className="api-selector-group" role="group">
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
                {item.examples.map(example => {
                  const exampleSelected = example.id === value;
                  return (
                    <button
                      key={example.id}
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
