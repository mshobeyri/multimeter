import React from "react";
import { TestFlowSteps, FlowType, flowTypeOptions, TestData } from "mmt-core/TestData";
import TestFlowBox from "./TestFlowBox";
import { safeList } from "mmt-core/safer";
import { getTestFlowStepType } from "mmt-core/testParsePack";
import { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider } from 'react-complex-tree';

interface TestFlowProps {
    testData: TestData;
    update?: (newTest: { flow: TestFlowSteps }) => void;
}

const moveBox = (arr: TestFlowSteps, from: number, to: number): TestFlowSteps => {
    if (from === to || from === to - 1) return arr;
    const updated = [...arr];
    const [removed] = updated.splice(from, 1);
    // If dragging down, after removal, the target index decreases by 1
    const insertAt = from < to ? to - 1 : to;
    updated.splice(insertAt, 0, removed);
    return updated;
};

const getStepType = (step: any): FlowType => {
    if (!step || typeof step !== "object") return "call";
    const keys = Object.keys(step);
    return (keys[0] as FlowType) || "call";
};

const getDefaultStepForType = (type: FlowType): any => {
    switch (type) {
        case "call":
            return { call: "" };
        case "check":
            return { check: "" };
        case "if":
            return { if: "" };
        case "for":
            return { for: "" };
        case "assert":
            return { assert: "" };
        case "repeat":
            return { repeat: "" };
        case "js":
            return { js: "" };
        case "print":
            return { print: "" };
        case "end":
            return { end: "" };
        case "set":
            return { set: "" };
        case "var":
            return { var: "" };
        case "const":
            return { const: "" };
        case "let":
            return { let: "" };
        default:
            return { [type]: null };
    }
};

const updateStepKey = (step: any, newKey: FlowType) => {
    if (!step || typeof step !== "object") return getDefaultStepForType(newKey);
    const oldKey = Object.keys(step)[0];
    const value = step[oldKey];
    // If the value is not compatible with the new type, use default
    if (newKey === oldKey) return step;
    return getDefaultStepForType(newKey);
};

const updateStepValue = (step: any, value: any) => {
    if (!step || typeof step !== "object") return step;
    const key = Object.keys(step)[0];
    // Only allow update if the key is a valid FlowType
    if (!["call", "direct", "check", "if", "for"].includes(key)) return step;
    // Build a valid TestFlowStep for the key
    switch (key) {
        case "call":
            return { call: value };
        case "direct":
            return { direct: value };
        case "check":
            return { check: value };
        case "if":
            return { if: value };
        case "for":
            return { for: value };
        default:
            return step;
    }
};

const TestFlow: React.FC<TestFlowProps> = ({ testData, update }) => {
    const flow = safeList(testData.steps);
    const [shortTree, setShortTree] = React.useState(() => testDataToShortTree(testData));

    React.useEffect(() => {
        setShortTree(testDataToShortTree(testData));
    }, [testData]);

    function testDataToShortTree(testData: TestData): {
        items: Record<string, any>;
    } {
        const steps = Array.isArray(testData.steps) ? testData.steps : [];
        let items: Record<string, any> = {};

        // Helper to recursively process steps
        function toItem(step: any, idx: number, parentKey: string): string {
            const type = getTestFlowStepType(step);
            const key = `${parentKey}_child${idx}`;
            let children: string[] = [];

            // If step has nested steps, process them recursively
            if ((type === 'for' || type === 'if' || type === 'repeat') && Array.isArray(step.steps)) {
                step.steps.forEach((subStep: any, subIdx: number) => {
                    const childKey = toItem(subStep, subIdx, key);
                    children.push(childKey);
                });
            }

            items[key] = {
                index: key,
                isFolder: children.length > 0,
                canMove: true,
                children,
                data: JSON.stringify({ type, data: { stepData: step } }),
                canRename: true,
            };
            return key;
        }

        // Build top-level children from root steps
        const topChildren: string[] = [];
        steps.forEach((step, idx) => {
            const childKey = toItem(step, idx, "container");
            topChildren.push(childKey);
        });

        // Root node
        items.root = {
            index: 'root',
            isFolder: true,
            children: ['container'],
            data: JSON.stringify({ type: "root", data: { stepData: "Root" } }),
            type: 'root',
        };

        // Container node (holds all top-level steps)
        items.container = {
            index: 'container',
            isFolder: true,
            children: topChildren,
            data: JSON.stringify({ type: "container", data: { stepData: "Flow" } }),
        };

        return { items };
    }

    return (
        <UncontrolledTreeEnvironment
            canDragAndDrop={true}
            canDropOnFolder={true}
            canReorderItems={true}
            dataProvider={new StaticTreeDataProvider(shortTree.items, (item, data) => ({ ...item, data }))}
            getItemTitle={item => item.data}
            viewState={{
                ['tree-1']: {
                    expandedItems: ['container'],
                },
            }}
            // renderItemTitle={({ title }) => <span>{title}</span>}
            renderItemArrow={({ item, context }) =>
                item.isFolder ? (
                    <span {...context.arrowProps}>
                        {context.isExpanded ? (
                            <span className="codicon codicon-chevron-down" style={{ fontSize: "16px" }}></span>
                        ) : (
                            <span className="codicon codicon-chevron-right" style={{ fontSize: "16px" }}></span>
                        )}
                    </span>
                ) : null
            }
            renderItem={({ title, arrow, context, children }) => {
                const item = JSON.parse(title as string);
                return (
                    <div {...context.itemContainerWithChildrenProps}
                        style={{
                            backgroundColor: context.isDraggingOver ? "var(--vscode-list-activeSelectionBackground, #264f78)" : "transparent",
                            borderRadius: "2px",
                        }}>
                        <div className="inner-box"
                            {...context.itemContainerWithoutChildrenProps}
                            {...context.interactiveElementProps}
                            style={{
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            {arrow}
                            <TestFlowBox
                                data={{
                                    type: item.type as FlowType,
                                    step: item.data.value,
                                    testData
                                }}
                                onChange={() => { /* implement handler or leave empty for now */ }}
                            ></TestFlowBox>
                        </div>
                        {children}
                    </div>
                );
            }}
            renderTreeContainer={({ children, containerProps }) => <div {...containerProps}>{children}</div>}
            renderItemsContainer={({ children, containerProps }) => <ul {...containerProps}>{children}</ul>}
        >
            <Tree treeId="tree-1" rootItem="root" treeLabel="Tree Example" />
        </UncontrolledTreeEnvironment>
    );
};

export default TestFlow;