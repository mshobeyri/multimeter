import React from "react";
import { TestFlowSteps, FlowType, TestData } from "mmt-core/TestData";
import TestFlowBox from "./TestFlowBox";
import { getTestFlowStepType } from "mmt-core/testParsePack";
import { ControlledTreeEnvironment, Tree, InteractionMode, DraggingPosition, DraggingPositionItem, DraggingPositionBetweenItems } from 'react-complex-tree';

interface TestFlowProps {
    testData: TestData;
    update?: (patch: { steps?: any[]; stages?: any[] }) => void;
}

// Collect all folder item ids
const collectFolderIds = (items: Record<string, any>, includeEmpty = true): string[] =>
    Object.values(items)
        .filter((it: any) => it?.isFolder && (includeEmpty || (it.children?.length > 0)))
        .map((it: any) => String(it.index));

const TestFlow: React.FC<TestFlowProps> = ({ testData, update }) => {
    const isStages = Array.isArray(testData.stages);
    const [shortTree, setShortTree] = React.useState(() => testDataToShortTree(testData));
    // Initialize expanded with all folders
    const [expandedItems, setExpandedItems] = React.useState<string[]>(
        () => collectFolderIds(shortTree.items)
    );
    // Track selected items to toggle active class on click
    const [selectedItems, setSelectedItems] = React.useState<string[]>([]);
    React.useEffect(() => {
        try {
            const newTree = testDataToShortTree(testData);
            setShortTree(newTree);
            // Expand all folders after rebuild
            setExpandedItems(collectFolderIds(newTree.items));
            // If you want to preserve user expansions, use:
            // setExpandedItems(prev => Array.from(new Set([...prev, ...collectFolderIds(newTree.items)])));
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

        // Copy the items tree
        const itemsCopy = { ...shortTree.items };

        // Helper: remove dragged items from their current parent
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

        // After reordering, convert tree back to flow and notify
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

    const addItem = () => {
        const itemsCopy = { ...shortTree.items } as Record<string, any>;
        const selectedKey = selectedItems.length === 1 ? selectedItems[0] : undefined;

        const makeNode = (key: string) => ({
            index: key,
            isFolder: false,
            canMove: true,
            children: [],
            data: JSON.stringify({ type: 'print', data: { stepData: { print: '' } } }),
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
            const node = makeNode(key);
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
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button className="add-button" onClick={addItem} title="Add flow item">Add item</button>
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
                // Toggle: if the same single item is selected again, clear selection to collapse
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
                    if (e.nativeEvent?.stopImmediatePropagation) e.nativeEvent.stopImmediatePropagation();
                };

                const NoTreeInterference: React.FC<{ children: React.ReactNode }> = ({ children }) => (
                    <div
                        onMouseDownCapture={stopAll}
                        onClickCapture={stopAll}
                        onFocusCapture={stopAll}
                        onKeyDownCapture={stopAll}
                        onKeyUpCapture={stopAll}
                        onInputCapture={stopAll}
                    >
                        {children}
                    </div>
                );

                return (
                    <div {...context.itemContainerWithChildrenProps}>
                        <div
                            className={`tree-view-box${context.isSelected && isExpandable(itemParsed.type) ? ' active' : ''}`}
                            {...context.itemContainerWithoutChildrenProps}
                            {...context.interactiveElementProps}
                        >
                            {arrow}
                            <NoTreeInterference>
                                <TestFlowBox
                                    data={{
                                        type: itemParsed.type as FlowType,
                                        stepData: itemParsed.data.stepData,
                                        testData,
                                    }}
                                    onChange={(newStepData) => {
                                        // Update this item's stepData in the tree
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
                                            // Convert to flow and notify upstream
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
                                />
                            </NoTreeInterference>
                        </div>
                        {children}
                    </div>
                );
            }}
            renderTreeContainer={({ children, containerProps }) => <div {...containerProps}>{children}</div>}
            renderItemsContainer={({ children, containerProps }) => <ul {...containerProps}>{children}</ul>}
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

    // deterministic path-based keys: flow_0, flow_0_0, ...
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

    // top-level children
    const topChildren: string[] = [];
    flow.forEach((step: any, i: number) => {
        const key = `flow_${i}`;
        topChildren.push(key);
        toItem(step, key);
    });

    // root and container
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

// Reusable: Convert react-complex-tree items back into TestFlowSteps
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
        // For folder-like steps, write back children under `steps`
        const newSteps = kids.map((k) => buildStepFromTree(items, k));
        return { ...base, steps: newSteps };
    }
    return base;
}
