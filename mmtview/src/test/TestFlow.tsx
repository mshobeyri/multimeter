import React from "react";
import { TestFlowSteps, FlowType, flowTypeOptions } from "./TestData";
import TestFlowBox from "./TestFlowBox";

interface TestFlowProps {
    flow: TestFlowSteps;
    update?: (newFlow: TestFlowSteps) => void;
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

const TestFlow: React.FC<TestFlowProps> = ({ flow, update }) => {
    const [draggedIdx, setDraggedIdx] = React.useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = React.useState<number | null>(null);

    // Helper to update a single step in the flow
    const updateStep = (idx: number, patch: any) => {
        if (!update) return;
        const newFlow = flow.map((step, i) => (i === idx ? { ...step, ...patch } : step));
        update(newFlow);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, padding: 0 }}>
            {flow.map((step, idx) => {
                const currentType: FlowType =
                    step && "type" in step && typeof (step as any).type === "string"
                        ? (step as any).type
                        : (step ? (Object.keys(step)[0] as FlowType) : "call") || "call";
                return (
                    <React.Fragment key={idx}>
                        {/* Drop area before each item */}
                        {update && (
                            <div
                                onDragOver={e => {
                                    e.preventDefault();
                                    setDragOverIdx(idx);
                                }}
                                onDrop={() => {
                                    if (
                                        update &&
                                        draggedIdx !== null &&
                                        draggedIdx !== idx
                                    ) {
                                        update(moveBox(flow, draggedIdx, idx));
                                    }
                                    setDraggedIdx(null);
                                    setDragOverIdx(null);
                                }}
                                onDragLeave={() => setDragOverIdx(null)}
                                style={{
                                    height: 16,
                                    margin: "0 0 0 0",
                                    background:
                                        dragOverIdx === idx
                                            ? "var(--vscode-editor-selectionBackground, #264f78cc)"
                                            : "transparent",
                                    borderRadius: 4,
                                    transition: "background 0.2s",
                                    cursor: "pointer",
                                }}
                            />
                        )}
                        <div
                            style={{
                                position: "relative",
                                padding: "16px",
                                background: "var(--vscode-editorWidget-background, #232323)",
                                border: "2px solid var(--vscode-editorWidget-border, #333)",
                                borderRadius: 6,
                                color: "var(--vscode-editor-foreground, #fff)",
                                fontWeight: "bold",
                                userSelect: "none",
                                opacity: draggedIdx === idx ? 0.5 : 1,
                                transition: "background 0.35s",
                            }}
                        >
                            {/* Combo for type */}
                            <select
                                value={currentType}
                                onChange={e => updateStep(idx, { type: e.target.value })}
                                style={{ marginBottom: 8, marginRight: 20 }}
                            >
                                {flowTypeOptions.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                            {/* UI for the selected type */}
                            <TestFlowBox
                                type={currentType}
                                step={step}
                                onChange={patch => updateStep(idx, patch)}
                            />
                            {update && (
                                <span
                                    role="button"
                                    title="Move"
                                    tabIndex={0}
                                    draggable
                                    onDragStart={e => {
                                        setDraggedIdx(idx);
                                        e.stopPropagation();
                                    }}
                                    onDragEnd={() => {
                                        setDraggedIdx(null);
                                        setDragOverIdx(null);
                                    }}
                                    style={{
                                        position: "absolute",
                                        top: 8,
                                        right: 8,
                                        cursor: "grab",
                                        fontSize: 22,
                                        userSelect: "none",
                                        background: "none",
                                        border: "none",
                                        outline: "none",
                                        zIndex: 2,
                                    }}
                                >
                                    🟰
                                </span>
                            )}
                        </div>
                    </React.Fragment>
                );
            })}
            {/* Drop area after the last item */}
            {update && (
                <div
                    onDragOver={e => {
                        e.preventDefault();
                        setDragOverIdx(flow.length);
                    }}
                    onDrop={() => {
                        if (
                            update &&
                            draggedIdx !== null &&
                            draggedIdx !== flow.length
                        ) {
                            update(moveBox(flow, draggedIdx, flow.length));
                        }
                        setDraggedIdx(null);
                        setDragOverIdx(null);
                    }}
                    onDragLeave={() => setDragOverIdx(null)}
                    style={{
                        height: 16,
                        margin: "0 0 0 0",
                        background:
                            dragOverIdx === flow.length
                                ? "var(--vscode-editor-selectionBackground, #264f78cc)"
                                : "transparent",
                        borderRadius: 4,
                        transition: "background 0.2s",
                        cursor: "pointer",
                    }}
                />
            )}
        </div>
    );
};

export default TestFlow;