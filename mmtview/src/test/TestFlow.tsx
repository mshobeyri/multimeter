import React from "react";
import { TestFlowSteps, FlowType, TestData } from "mmt-core/TestData";
import TestFlowBox from "./TestFlowBox";
import { getTestFlowStepType } from "mmt-core/testParsePack";
import { ControlledTreeEnvironment, Tree, InteractionMode, DraggingPosition, DraggingPositionItem, DraggingPositionBetweenItems } from 'react-complex-tree';

interface TestFlowProps {
    testData: TestData;
    update?: (newTest: { flow: TestFlowSteps }) => void;
}

const TestFlow: React.FC<TestFlowProps> = ({ testData, update }) => {
    const [shortTree, setShortTree] = React.useState(() => testDataToShortTree(testData));
    const [expandedItems, setExpandedItems] = React.useState<string[]>([]);
    const [draggedItem, setDraggedItem] = React.useState<string | null>(null);

    React.useEffect(() => {
        try {
            const newTree = testDataToShortTree(testData);
            setShortTree(newTree);
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

        if (target.targetType === 'item') {
            setExpandedItems(prev => (prev.includes(String(target.targetItem)) ? prev : [...prev, String(target.targetItem)]));
        } else if (target.targetType === 'between-items') {
            const parentItem = (target as DraggingPositionBetweenItems).parentItem;
            if (parentItem) {
                setExpandedItems(prev => (prev.includes(String(parentItem)) ? prev : [...prev, String(parentItem)]));
            }
        }
    };

    return (
        <ControlledTreeEnvironment
            items={shortTree.items}
            getItemTitle={item => item.data}
            viewState={{
                ['tree-1']: {
                    expandedItems,
                },
            }}
            onExpandItem={handleExpand}
            onCollapseItem={handleCollapse}
            canDragAndDrop={true}
            canDropOnFolder={true}
            canReorderItems={true}
            onDrop={handleDrop}
            renderItemArrow={({ item, context }) =>
                item.isFolder ? (
                    <span {...context.arrowProps}>
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

                return (
                    <div {...context.itemContainerWithChildrenProps}>
                        <div
                            className="inner-box"
                            {...context.itemContainerWithoutChildrenProps}
                            {...context.interactiveElementProps}
                            style={{
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                position: "relative",
                                borderColor: context.isDraggingOver
                                    ? "var(--vscode-focusBorder, #264f78)"
                                    : "var(--vscode-editorWidget-border, #333)",
                            }}
                        >
                            {arrow}
                            <TestFlowBox
                                data={{
                                    type: itemParsed.type as FlowType,
                                    stepData: itemParsed.data.stepData,
                                    testData,
                                }}
                                onChange={() => { /* implement handler if needed */ }}
                            />
                            {/* Drag handle only */}
                            <span
                                className="codicon codicon-grabber"
                                draggable
                                onDragStart={e => {
                                    setDraggedItem(String(item.index));
                                    e.stopPropagation();
                                }}
                                onDragEnd={e => {
                                    setDraggedItem(null);
                                    e.stopPropagation();
                                }}
                                style={{
                                    position: "absolute",
                                    top: 8,
                                    right: 8,
                                    cursor: "grab",
                                    fontSize: "18px",
                                    userSelect: "none",
                                    background: "none",
                                    border: "none",
                                    zIndex: 2,
                                }}
                                title="Drag to move"
                            />
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


export default TestFlow;
