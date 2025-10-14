import React from "react";
import { TestFlowSteps, FlowType, TestData } from "mmt-core/TestData";
import TestFlowBox from "./TestFlowBox";
import { getTestFlowStepType } from "mmt-core/testParsePack";
import { ControlledTreeEnvironment, Tree, DraggingPosition, DraggingPositionItem, DraggingPositionBetweenItems } from 'react-complex-tree';

interface TestFlowProps {
    testData: TestData;
    update?: (patch: { steps?: any[]; stages?: any[] }) => void;
}

const collectFolderIds = (items: Record<string, any>, includeEmpty = true): string[] =>
    Object.values(items)
        .filter((it: any) => it?.isFolder && (includeEmpty || (it.children?.length > 0)))
        .map((it: any) => String(it.index));

const TestFlow: React.FC<TestFlowProps> = ({ testData, update }) => {
    const isStages = Array.isArray(testData.stages);
    const [shortTree, setShortTree] = React.useState(() => testDataToShortTree(testData));
    const [expandedItems, setExpandedItems] = React.useState<string[]>(
        () => collectFolderIds(shortTree.items)
    );
    const [selectedItems, setSelectedItems] = React.useState<string[]>([]);

    React.useEffect(() => {
        try {
            const newTree = testDataToShortTree(testData);
            setShortTree(newTree);
            setExpandedItems(collectFolderIds(newTree.items));
        } catch (error) {
            console.error("Error updating short tree:", error);
        }
    }, [testData]);

    const handleExpand = (item: any, treeId: string) => {
        if (treeId !== 'tree-1') return;
        setExpandedItems(prev => (prev.includes(item.index) ? prev : [...prev, item.index]));
    };

    const handleCollapse = (item: any, treeId: string) => {
        if (treeId !== 'tree-1') return;
        setExpandedItems(prev => prev.filter(i => i !== item.index));
    };

    const handleDrop = (
        draggedItems: any[],
        target: DraggingPosition
    ) => {
        if (!Array.isArray(draggedItems) || draggedItems.length === 0) return;
        const itemsCopy = { ...shortTree.items };
        const removeDraggedFromParent = (index: string) => {
            const parentKey = Object.keys(itemsCopy).find(key =>
                itemsCopy[key].children?.includes(index)
            );
            if (parentKey) {
                const newChildren = itemsCopy[parentKey].children.filter((c: string) => c !== index);
                itemsCopy[parentKey] = {
                    ...itemsCopy[parentKey],
                    children: newChildren,
                };
                if (newChildren.length === 0) {
                    itemsCopy[parentKey] = { ...itemsCopy[parentKey], isFolder: true };
                }
            }
        };

        draggedItems.forEach(di => removeDraggedFromParent(di.index));

        if (target.targetType === "item") {
            const targetKey = (target as DraggingPositionItem).targetItem;
            const existing = itemsCopy[targetKey].children || [];
            const newChildren = [
                ...existing,
                ...draggedItems.map(di => di.index),
            ];
            itemsCopy[targetKey] = {
                ...itemsCopy[targetKey],
                children: newChildren,
                isFolder: true,
            };
        } else if (target.targetType === "between-items") {
            const parentKey = (target as DraggingPositionBetweenItems).parentItem;
            const siblings = itemsCopy[parentKey].children;
            const insertIdx = (target as DraggingPositionBetweenItems).linePosition === "bottom"
                ? (target as DraggingPositionBetweenItems).childIndex + 1
                : (target as DraggingPositionBetweenItems).childIndex;
            const newChildren = [
                ...siblings.slice(0, insertIdx),
                ...draggedItems.map(di => di.index),
                ...siblings.slice(insertIdx),
            ];
            itemsCopy[parentKey] = {
                ...itemsCopy[parentKey],
                children: newChildren,
            };
        } else if (target.targetType === "root") {
            const rootKey = 'flow';
            const siblings = itemsCopy[rootKey].children;
            const newChildren = [...siblings, ...draggedItems.map(di => di.index)];
            itemsCopy[rootKey] = {
                ...itemsCopy[rootKey],
                children: newChildren,
            };
        }

        setShortTree({ items: itemsCopy });
        try {
            const newFlow = treeItemsToFlow(itemsCopy, 'flow');
            const patch = isStages ? { stages: newFlow } : { steps: newFlow };
            update && update(patch);
        } catch (e) {
            console.error('Failed to convert tree to flow:', e);
        }

        if (target.targetType === 'item') {
            setExpandedItems(prev => (prev.includes(String(target.targetItem)) ? prev : [...prev, String(target.targetItem)]));
        } else if (target.targetType === 'between-items') {
            const parentItem = (target as DraggingPositionBetweenItems).parentItem;
            if (parentItem) {
                setExpandedItems(prev => (prev.includes(String(parentItem)) ? prev : [...prev, String(parentItem)]));
            }
        }
    };

    const [addMenuOpen, setAddMenuOpen] = React.useState(false);
    const [addMenuPos, setAddMenuPos] = React.useState<{ left: number; top: number } | null>(null);
    const addBtnRef = React.useRef<HTMLButtonElement | null>(null);

    React.useEffect(() => {
        if (!addMenuOpen) return;
        const onDocDown = (e: MouseEvent) => {
            const t = e.target as Node | null;
            if (addBtnRef.current && addBtnRef.current.contains(t as Node)) return;
            setAddMenuOpen(false);
        };
        document.addEventListener('click', onDocDown, true);
        window.addEventListener('resize', () => setAddMenuOpen(false), { once: true });
        return () => document.removeEventListener('click', onDocDown, true);
    }, [addMenuOpen]);

    const openAddMenuAtButton = () => {
        const el = addBtnRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setAddMenuPos({ left: Math.max(8, r.right - 200), top: r.bottom + 6 });
    };

    const createDefaultStep = (type: string): any => {
        switch (type) {
            case 'print': return { print: '' };
            case 'call': return { call: '', id: '', inputs: {} };
            case 'js': return { js: '' };
            case 'set': return { set: {} };
            case 'var': return { var: {} };
            case 'const': return { const: {} };
            case 'let': return { let: {} };
            case 'check': return { check: '1 == 1' };
            case 'if': return { if: '1 != 1', steps: [] };
            case 'for': return { for: '' };
            case 'repeat': return { repeat: '' };
            case 'stage': return { stage: '', steps: [] };
            default: return { print: '' };
        }
    };

    const addItemOfType = (type: string) => {
        const itemsCopy = { ...shortTree.items } as Record<string, any>;
        const selectedKey = selectedItems.length === 1 ? selectedItems[0] : undefined;

        const makeNode = (key: string, stepObj: any) => ({
            index: key,
            isFolder: false,
            canMove: true,
            children: [],
            data: JSON.stringify({ type: getTestFlowStepType(stepObj), data: { stepData: stepObj } }),
            canRename: true,
        });

        const uniqueKey = (base: string) => {
            let k = `${base}_${Date.now().toString(36)}`;
            while (itemsCopy[k]) { k = `${base}_${Math.random().toString(36).slice(2, 8)}`; }
            return k;
        };

        const insertUnder = (parentKey: string, afterKey?: string) => {
            const parent = itemsCopy[parentKey];
            if (!parent) return;
            const key = uniqueKey(parentKey);
            const node = makeNode(key, createDefaultStep(type));
            itemsCopy[key] = node;
            const children: string[] = Array.isArray(parent.children) ? [...parent.children] : [];
            if (afterKey) {
                const idx = children.indexOf(afterKey);
                const insertIdx = idx >= 0 ? idx + 1 : children.length;
                children.splice(insertIdx, 0, key);
            } else {
                children.push(key);
            }
            itemsCopy[parentKey] = { ...parent, children };
        };

        const findParentOf = (childKey: string | undefined): string | undefined => {
            if (!childKey) return undefined;
            return Object.keys(itemsCopy).find(pk => Array.isArray(itemsCopy[pk].children) && itemsCopy[pk].children.includes(childKey));
        };

        if (selectedKey) {
            const sel = itemsCopy[selectedKey];
            if (sel?.isFolder) {
                insertUnder(selectedKey);
            } else {
                const parentKey = findParentOf(selectedKey) || 'flow';
                insertUnder(parentKey, selectedKey);
            }
        } else {
            insertUnder('flow');
        }

        setShortTree({ items: itemsCopy });
        try {
            const flow = treeItemsToFlow(itemsCopy, 'flow');
            const patch = isStages ? { stages: flow } : { steps: flow };
            update && update(patch);
        } catch (e) {
            console.error('Failed to convert tree to flow after add:', e);
        }
    };

    return (
        <div className="test-flow-tree">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, position: 'relative' }}>
                <button
                    ref={addBtnRef}
                    className="add-button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => { e.stopPropagation(); setAddMenuOpen(v => { const next = !v; if (!v) openAddMenuAtButton(); return next; }); }}
                    title="Add flow item"
                >
                    Add item
                </button>
                {addMenuOpen && addMenuPos && (
                    <div style={{ position: 'fixed', left: addMenuPos.left, top: addMenuPos.top, zIndex: 1000, background: 'var(--vscode-editorWidget-background,#232323)', border: '1px solid var(--vscode-editorWidget-border,#333)', borderRadius: 4, boxShadow: '0 2px 6px rgba(0,0,0,0.4)', minWidth: 200 }}
                         onPointerDown={(e) => e.stopPropagation()}
                         onMouseDown={(e) => e.stopPropagation()}
                         onClick={(e) => e.stopPropagation()}>
                        {['print','call','js','set','var','const','let','check','if','for','repeat','stage'].map(t => (
                            <button key={t} className="action-button" style={{ width: '100%', justifyContent: 'flex-start' }} onPointerUp={() => { setAddMenuOpen(false); addItemOfType(t); }}>
                                {t}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        <ControlledTreeEnvironment
            items={shortTree.items}
            getItemTitle={item => item.data}
            viewState={{
                ['tree-1']: {
                    expandedItems,
                    selectedItems,
                },
            }}
            onExpandItem={handleExpand}
            onCollapseItem={handleCollapse}
            canDragAndDrop={true}
            canDropOnFolder={true}
            canReorderItems={true}
            onDrop={handleDrop}
            onSelectItems={(items, treeId) => {
                if (treeId !== 'tree-1') return;
                const next = items as string[];
                if (next.length === 1 && selectedItems.length === 1 && selectedItems[0] === next[0]) {
                    setSelectedItems([]);
                } else {
                    setSelectedItems(next);
                }
            }}
            renderItemArrow={({ item, context }) =>
                item.isFolder ? (
                    <span
                        {...context.arrowProps}
                        style={{
                            display: "inline-flex",
                            paddingTop: 8, 
                            lineHeight: 0,
                            alignSelf: "flex-start"
                        }}
                    >
                        {context.isExpanded ? (
                            <span className="codicon codicon-chevron-down" style={{ fontSize: "16px" }} />
                        ) : (
                            <span className="codicon codicon-chevron-right" style={{ fontSize: "16px" }} />
                        )}
                    </span>
                ) : null
            }
            renderItem={({ title, arrow, context, item, children }) => {
                if (!title) return null;
                let itemParsed = { type: "unknown", data: { stepData: title } };
                try {
                    itemParsed = JSON.parse(title as string);
                } catch (err) {
                    console.error("Error parsing item:", err);
                }

                const stopAll = (e: React.SyntheticEvent) => {
                    e.stopPropagation();
                };

                const NoTreeInterference: React.FC<{ children: React.ReactNode }> = ({ children }) => (
                    <div
                        onMouseDownCapture={stopAll}
                        onClickCapture={stopAll}
                        onFocusCapture={stopAll}
                        onKeyDownCapture={stopAll}
                        onKeyUpCapture={stopAll}
                        onInputCapture={stopAll}
                        style={{ flex: 1, minWidth: 0 }}
                    >
                        {children}
                    </div>
                );

                const duplicateSubtree = (itemsCopy: Record<string, any>, key: string): string | null => {
                    const src = itemsCopy[key];
                    if (!src) return null;
                    const base = key.split('_')[0] || 'node';
                    let newKey = `${base}_${Math.random().toString(36).slice(2, 8)}`;
                    while (itemsCopy[newKey]) newKey = `${base}_${Math.random().toString(36).slice(2, 8)}`;
                    const newNode = { ...src, index: newKey, children: [] as string[] };
                    itemsCopy[newKey] = newNode;
                    const kids: string[] = Array.isArray(src.children) ? src.children : [];
                    for (const child of kids) {
                        const dupChild = duplicateSubtree(itemsCopy, child);
                        if (dupChild) {
                            newNode.children.push(dupChild);
                        }
                    }
                    return newKey;
                };

                const findParentOf = (itemsCopy: Record<string, any>, childKey: string): string | undefined => {
                    return Object.keys(itemsCopy).find(pk => Array.isArray(itemsCopy[pk].children) && itemsCopy[pk].children.includes(childKey));
                };

                const removeSubtree = (itemsCopy: Record<string, any>, key: string) => {
                    const node = itemsCopy[key];
                    if (!node) return;
                    // remove children first
                    const kids: string[] = Array.isArray(node.children) ? node.children : [];
                    for (const c of kids) removeSubtree(itemsCopy, c);
                    delete itemsCopy[key];
                };

                const doDuplicate = (targetKey: string) => {
                    setShortTree(prev => {
                        const itemsCopy = { ...prev.items } as Record<string, any>;
                        const parentKey = findParentOf(itemsCopy, targetKey) || 'flow';
                        const dupKey = duplicateSubtree(itemsCopy, targetKey);
                        if (dupKey) {
                            const parent = itemsCopy[parentKey];
                            const children: string[] = Array.isArray(parent.children) ? [...parent.children] : [];
                            const idx = children.indexOf(targetKey);
                            const insertIdx = idx >= 0 ? idx + 1 : children.length;
                            children.splice(insertIdx, 0, dupKey);
                            itemsCopy[parentKey] = { ...parent, children };
                        }
                        try {
                            const flow = treeItemsToFlow(itemsCopy, 'flow');
                            const patch = isStages ? { stages: flow } : { steps: flow };
                            update && update(patch);
                        } catch (e) { console.error('Failed to convert after duplicate:', e); }
                        return { items: itemsCopy };
                    });
                };

                const doRemove = (targetKey: string) => {
                    if (targetKey === 'root' || targetKey === 'flow') return;
                    setShortTree(prev => {
                        const itemsCopy = { ...prev.items } as Record<string, any>;
                        const parentKey = findParentOf(itemsCopy, targetKey) || 'flow';
                        const parent = itemsCopy[parentKey];
                        const children: string[] = Array.isArray(parent.children) ? [...parent.children] : [];
                        const idx = children.indexOf(targetKey);
                        if (idx >= 0) children.splice(idx, 1);
                        itemsCopy[parentKey] = { ...parent, children };
                        removeSubtree(itemsCopy, targetKey);
                        try {
                            const flow = treeItemsToFlow(itemsCopy, 'flow');
                            const patch = isStages ? { stages: flow } : { steps: flow };
                            update && update(patch);
                        } catch (e) { console.error('Failed to convert after remove:', e); }
                        return { items: itemsCopy };
                    });
                };

                return (
                    <div {...context.itemContainerWithChildrenProps}>
                        <div
                            className={`tree-view-box${context.isSelected && isExpandable(itemParsed.type) ? ' active' : ''}`}
                            {...context.itemContainerWithoutChildrenProps}
                            {...context.interactiveElementProps}
                        >
                            {arrow}
                            <NoTreeInterference>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <TestFlowBox
                                        data={{
                                            type: itemParsed.type as FlowType,
                                            stepData: itemParsed.data.stepData,
                                            testData,
                                        }}
                                        onChange={(newStepData) => {
                                            setShortTree(prev => {
                                                const itemsCopy = { ...prev.items } as Record<string, any>;
                                                const cur = itemsCopy[item.index];
                                                if (cur) {
                                                    const parsed = JSON.parse(cur.data);
                                                    itemsCopy[item.index] = {
                                                        ...cur,
                                                        data: JSON.stringify({ type: parsed.type, data: { stepData: newStepData } })
                                                    };
                                                }
                                                try {
                                                    const flow = treeItemsToFlow(itemsCopy, 'flow');
                                                    const patch = isStages ? { stages: flow } : { steps: flow };
                                                    update && update(patch);
                                                } catch (e) {
                                                    console.error('Failed to convert tree to flow after edit:', e);
                                                }
                                                return { items: itemsCopy };
                                            });
                                        }}
                                        onDuplicate={() => doDuplicate(String(item.index))}
                                        onRemove={() => doRemove(String(item.index))}
                                    />
                                </div>
                            </NoTreeInterference>
                            {/* actions handled within TestFlowBox */}
                        </div>
                        {children}
                    </div>
                );
            }}
            renderTreeContainer={({ children, containerProps }) => <div {...containerProps}>{children}</div>}
            renderItemsContainer={({ children, containerProps }) => <ul {...containerProps} style={{ ...(containerProps.style || {}), margin: 0, listStyle: 'none' }}>{children}</ul>}
            renderDragBetweenLine={({ lineProps }) => (
                <div {...lineProps} style={{ background: "var(--vscode-focusBorder, #264f78)", height: "1px" }} />
            )}
        >
            <Tree treeId="tree-1" rootItem="root" treeLabel="Tree Example" />
    </ControlledTreeEnvironment>
    </div>
    );
};

function testDataToShortTree(testData: TestData): { items: Record<string, any> } {
    const flow = Array.isArray(testData.stages)
        ? testData.stages
        : Array.isArray(testData.steps)
            ? testData.steps
            : [];

    const items: Record<string, any> = {};

    function toItem(step: any, path: string) {
        const type = getTestFlowStepType(step);
        const children: string[] = [];

        if (Array.isArray(step.steps)) {
            step.steps.forEach((childStep: any, idx: number) => {
                const childPath = `${path}_${idx}`;
                children.push(childPath);
                toItem(childStep, childPath);
            });
        }

        items[path] = {
            index: path,
            isFolder: isTypeFolder(type),
            canMove: true,
            children,
            data: JSON.stringify({ type, data: { stepData: step } }),
            canRename: true,
        };
    }
    const topChildren: string[] = [];
    flow.forEach((step: any, i: number) => {
        const key = `flow_${i}`;
        topChildren.push(key);
        toItem(step, key);
    });

    items.root = {
        index: 'root',
        isFolder: true,
        children: ['flow'],
        data: JSON.stringify({ type: "root", data: { stepData: "Root" } }),
        type: 'root',
    };

    items.flow = {
        index: 'flow',
        isFolder: true,
        children: topChildren,
        data: JSON.stringify({ type: "flow", data: { stepData: "Flow" } }),
    };

    return { items };
}

const isTypeFolder = (type: FlowType | unknown): boolean => {
    return type === "stage" || type === "stages" || type === "steps" || type === "if" || type === "for" || type === "repeat";
}

const isExpandable = (type: FlowType | unknown): boolean => {
    return type === "print" || type === "js" || type === "call" || type === "set" || type === "var" || type === "const" || type === "let";
}

export default TestFlow;

export function treeItemsToFlow(items: Record<string, any>, rootKey: string): TestFlowSteps {
    const root = items[rootKey];
    if (!root) return [] as TestFlowSteps;
    const order: string[] = Array.isArray(root.children) ? root.children : [];
    return order.map((childKey: string) => buildStepFromTree(items, childKey));
}

function buildStepFromTree(items: Record<string, any>, key: string): any {
    const node = items[key];
    if (!node) return {};
    let parsed: { type: string; data: { stepData: any } };
    try {
        parsed = JSON.parse(node.data);
    } catch {
        parsed = { type: 'unknown', data: { stepData: {} } } as any;
    }
    const base = parsed.data.stepData || {};
    const kids: string[] = Array.isArray(node.children) ? node.children : [];
    if (kids.length > 0) {
        const newSteps = kids.map((k) => buildStepFromTree(items, k));
        return { ...base, steps: newSteps };
    }
    return base;
}
