import React from "react";
import { TestFlowSteps, FlowType, flowTypeOptions, TestData } from "./TestData";
import TestFlowBox from "./TestFlowBox";

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
    const flow = testData.flow ?? [];
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

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, padding: 0 }}>
            {flow.map((step, idx) => {
                const intentadd = flow.slice(0, idx).filter(s => {
                    const t = getStepType(s);
                    return t === "if" || t === "for";
                }).length;
                const intentremove = flow.slice(0, idx + 1).filter(s => {
                    const t = getStepType(s);
                    return t === "end";
                }).length;

                let intent = Math.max(intentadd - intentremove, 0);

                const currentType = getStepType(step);
                let value: any = "";
                if (step) {
                    switch (currentType) {
                        case "call":
                            value = (step as any).call ?? "";
                            break;
                        case "check":
                            value = (step as any).check ?? "";
                            break;
                        case "if":
                            value = (step as any).if ?? "";
                            break;
                        case "for":
                            value = (step as any).for ?? "";
                            break;
                        default:
                            value = "";
                    }
                }

                return (
                    <React.Fragment key={idx}>
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
                                        update({ ...testData, flow: moveBox(flow, draggedIdx, idx) });
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
                                marginLeft: intent * 16,
                                position: "relative",
                                padding: "16px",
                                background: "var(--vscode-editorWidget-background, #232323)",
                                border: "2px solid var(--vscode-editorWidget-border, #333)",
                                borderRadius: 6,
                                color: "var(--vscode-editor-foreground, #fff)",
                                userSelect: "none",
                                opacity: draggedIdx === idx ? 0.5 : 1,
                                transition: "background 0.35s",
                            }}
                        >
                            {/* Combo for type (changes YAML key, not adds a field) */}
                            <select
                                value={currentType}
                                onChange={e => changeStepType(idx, e.target.value as FlowType)}
                                style={{ marginBottom: 8, marginRight: 20 }}
                            >
                                {flowTypeOptions.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                            <TestFlowBox
                                type={currentType}
                                step={value}
                                testData={testData}
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
                            update({ ...testData, flow: moveBox(flow, draggedIdx, flow.length) });
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
            <button
                type="button"
                onClick={addFlowBox}
                style={{
                    background: "var(--vscode-button-background, #0e639c)",
                    color: "var(--vscode-button-foreground, #fff)",
                    border: "none",
                    borderRadius: 4,
                    padding: "8px 16px",
                    cursor: "pointer"
                }}
            >
                Add Step
            </button>
        </div>
    );
};

export default TestFlow;