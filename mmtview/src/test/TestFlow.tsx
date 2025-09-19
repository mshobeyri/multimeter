import React from "react";
import { TestFlowSteps, FlowType, flowTypeOptions, TestData } from "mmt-core/TestData";
import TestFlowBox from "./TestFlowBox";
import { safeList } from "mmt-core/safer";
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
    const [draggedIdx, setDraggedIdx] = React.useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = React.useState<number | null>(null);

    // Helper to update a single step in the flow
    const updateStep = (idx: number, patch: any) => {
        if (!update) return;
        const newFlow = flow.map((step, i) =>
            i === idx ? updateStepValue(step, patch) : step
        );
        update({ ...testData, flow: newFlow });
    };

    // Helper to change the type (key) of a step
    const changeStepType = (idx: number, newType: FlowType) => {
        if (!update) return;
        const newFlow = flow.map((step, i) =>
            i === idx ? updateStepKey(step, newType) : step
        );
        update({ ...testData, flow: newFlow });
    };

    // Add a new flow box (default to "call")
    const addFlowBox = () => {
        if (!update) return;
        const newFlow = [...flow, getDefaultStepForType("call")];
        update({ ...testData, flow: newFlow });
    };

    // Define a minimal shortTree object for the tree data
    const shortTree = {
        items: {
            root: {
                index: 'root',
                isFolder: true,
                children: ['container'],
                data: 'Root',
            },
            container: {
                index: 'container',
                isFolder: true,
                children: ['child0'],
                data: 'Container',
            },
            child0: {
                index: 'child0',
                isFolder: true,
                canMove: true,
                children: ['child1', 'child2'],
                data: 'Child 0',
                canRename: true,
            },
            child1: {
                index: 'child1',
                canMove: true,
                isFolder: true,
                children: [],
                data: 'Child item 1',
                canRename: true,
            },
            child2: {
                index: 'child2',
                canMove: true,
                isFolder: false,
                children: [],
                data: 'Child item 2',
                canRename: true,
            },
        },
    };


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
            renderItem={({ title, arrow, depth, context, children }) => {
                const InteractiveComponent = context.isRenaming ? 'div' : 'button';
                return (
                    <div {...context.itemContainerWithChildrenProps}>
                        <div
                            style={{ border: '1px solid #ccc', display: 'flex' }}
                            {...context.itemContainerWithoutChildrenProps}
                            {...context.interactiveElementProps}
                        >
                            {arrow}
                            <TestFlowBox
                                data={{
                                    type: "check",
                                    step: "xxx == xsss",
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