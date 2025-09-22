import React from "react";
import { TestFlowSteps, FlowType, flowTypeOptions, TestData } from "mmt-core/TestData";
import TestFlowBox from "./TestFlowBox";
import { safeList } from "mmt-core/safer";
import { getTestFlowStepType } from "mmt-core/testParsePack";
import { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider, InteractionMode } from 'react-complex-tree';

interface TestFlowProps {
    testData: TestData;
    update?: (newTest: { flow: TestFlowSteps }) => void;
}

const TestFlow: React.FC<TestFlowProps> = ({ testData, update }) => {
    const [shortTree, setShortTree] = React.useState(() => testDataToShortTree(testData));

    React.useEffect(() => {
        try {
            setShortTree(testDataToShortTree(testData));
        } catch (error) {
            console.error("Error updating short tree:", error);
        }
    }, [testData]);

    function testDataToShortTree(testData: TestData): {
        items: Record<string, any>;
    } {
        // Prefer stages if present, otherwise use steps
        const flow = Array.isArray(testData.stages) ? testData.stages : Array.isArray(testData.steps) ? testData.steps : [];
        let items: Record<string, any> = {};
        let nodeCount = 0;

        // Helper to recursively process steps and stages
        function toItem(step: any, parentKey: string): string {
            const type = getTestFlowStepType(step);
            const key = `${parentKey}_child${nodeCount++}`;
            let children: string[] = [];

            // Handle stages (top-level)
            if (Array.isArray(step.stages)) {
                step.stages.forEach((stage: any) => {
                    const childKey = toItem(stage, key);
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

        // Build top-level children from flow array
        const topChildren: string[] = [];
        flow.forEach((step: any) => {
            const childKey = toItem(step, "flow");
            topChildren.push(childKey);
        });

        // Root node
        items.root = {
            index: 'root',
            isFolder: true,
            children: ['flow'],
            data: JSON.stringify({ type: "root", data: { stepData: "Root" } }),
            type: 'root',
        };

        // Container node (holds all top-level steps/stages)
        items.flow = {
            index: 'flow',
            isFolder: true,
            children: topChildren,
            data: JSON.stringify({ type: "flow", data: { stepData: "Flow" } }),
        };

        return { items };
    }

    return (
        <UncontrolledTreeEnvironment
            defaultInteractionMode={InteractionMode.ClickArrowToExpand}
            canDragAndDrop={true}
            canDropOnFolder={true}
            canReorderItems={true}
            dataProvider={new StaticTreeDataProvider(shortTree.items, (item, data) => ({ ...item, data }))}
            getItemTitle={item => item.data}
            viewState={{
                ['tree-1']: {
                    expandedItems: ['flow'],
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
                if (!title) return null;
                let item = { type: "unknown", data: { stepData: title } };
                try {
                    item = JSON.parse(title as string);
                } catch (error) {
                    console.error("Error parsing item:", error);
                }
                return (
                    <div {...context.itemContainerWithChildrenProps}>
                        <div className="inner-box"
                            {...context.itemContainerWithoutChildrenProps}
                            style={{
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                position: "relative",
                                borderColor: context.isDraggingOver ? "var(--vscode-focusBorder, #264f78)" : "var(--vscode-editorWidget-border, #333)",
                            }}
                        >
                            {arrow}
                            <TestFlowBox
                                data={{
                                    type: item.type as FlowType,
                                    stepData: item.data.stepData,
                                    testData
                                }}
                                onChange={() => { /* implement handler or leave empty for now */ }}
                            />
                            {/* Drag handle as a direct child, not inside another div */}
                            <span
                                className="codicon codicon-grabber"
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
                                {...context.interactiveElementProps}
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
        </UncontrolledTreeEnvironment>
    );
};

export default TestFlow;