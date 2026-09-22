import React from "react";
import { TestFlowSteps, FlowType, TestData } from "mmt-core/TestData";
import TestFlowBox from "./TestFlowBox";
import { getTestFlowStepType } from "mmt-core/testParsePack";
import { ControlledTreeEnvironment, Tree, DraggingPosition, DraggingPositionItem, DraggingPositionBetweenItems } from 'react-complex-tree';
import { type MissingImportEntry } from "../text/validator";
import { codiconForStepType } from "./stepPresentation";
import TestFlowFlow from "./TestFlowFlow";
import {
    TREE_DEPTH_OFFSET,
    TreeDepthContainer,
    TreeExpandButton,
    TreeFolderArrow,
    treeDragBetweenLineStyle,
} from "../components/TreeChevron";

// Transparent drag image to remove native ghost preview while preserving drop lines
let dragPreviewEl: HTMLDivElement | null = null;
function setTransparentDragImage(dt: DataTransfer | null | undefined) {
    if (!dt) return;
    try {
        const el = document.createElement('div');
        el.setAttribute('aria-hidden', 'true');
        el.className = 'drag-preview-ghost';
        document.body.appendChild(el);
        dragPreviewEl = el;
        dt.setDragImage(el, 0, 0);
    } catch { }
}

interface ImportValidationInfo {
    missingImports: MissingImportEntry[];
    inputsByAlias: Record<string, string[]>;
    outputsByAlias?: Record<string, string[]>;
}

interface TestFlowProps {
    testData: TestData;
    update?: (patch: { steps?: any[]; stages?: any[] }) => void;
    importValidation?: ImportValidationInfo;
}

const collectFolderIds = (items: Record<string, any>, includeEmpty = true): string[] =>
    Object.values(items)
        .filter((it: any) => it?.isFolder && (includeEmpty || (it.children?.length > 0)))
        .filter((it: any) => {
            try {
                const parsed = JSON.parse(it.data);
                // Expandable folders share one opener; start collapsed so editor
                // and nested steps stay in sync.
                return !isExpandable(parsed?.type);
            } catch {
                return true;
            }
        })
        .map((it: any) => String(it.index));

const TestFlow: React.FC<TestFlowProps> = ({ testData, update, importValidation }) => {
    const isStages = Array.isArray(testData.stages);
    const [multiStage, setMultiStage] = React.useState<boolean>(isStages);
    const [shortTree, setShortTree] = React.useState(() => testDataToShortTree(testData));
    const [expandedItems, setExpandedItems] = React.useState<string[]>(
        () => collectFolderIds(shortTree.items)
    );
    // Toggle "active" mode per item for inline editors of expandable types
    const [openEditors, setOpenEditors] = React.useState<Record<string, boolean>>({});

    const treeRootRef = React.useRef<HTMLDivElement>(null);
    const [isFlowDragging, setIsFlowDragging] = React.useState(false);

    const beginFlowDrag = () => {
        treeRootRef.current?.classList.add('test-flow-tree--dragging');
        setIsFlowDragging(true);
        setOpenEditors({});
    };

    const endFlowDrag = () => {
        treeRootRef.current?.classList.remove('test-flow-tree--dragging');
        setIsFlowDragging(false);
        if (dragPreviewEl && dragPreviewEl.parentNode) {
            (dragPreviewEl.parentNode as Node).removeChild(dragPreviewEl);
        }
        dragPreviewEl = null;
    };

    const expandedInitializedRef = React.useRef(false);
    React.useEffect(() => {
        try {
            setMultiStage(Array.isArray(testData.stages));
            const newTree = testDataToShortTree(testData);
            setShortTree(newTree);
            setExpandedItems(prev => {
                const allIds = new Set(
                    Object.values(newTree.items).map((it: any) => String(it.index))
                );
                if (!expandedInitializedRef.current) {
                    expandedInitializedRef.current = true;
                    return collectFolderIds(newTree.items);
                }
                // preserve previous expanded entries that still exist
                return prev.filter(id => allIds.has(id));
            });
            // keep openEditors aligned with current items to avoid stale active icon after rebuilds
            setOpenEditors(prev => {
                const allIds = new Set(
                    Object.values(newTree.items).map((it: any) => String(it.index))
                );
                const next: Record<string, boolean> = {};
                for (const k of Object.keys(prev)) {
                    if (allIds.has(k)) next[k] = prev[k];
                }
                return next;
            });
        } catch (error) {
            console.error("Error updating short tree:", error);
        }
    }, [testData]);

    // Toggle multistage mode on root: switches between steps and stages in testData
    const toggleMultiStage = (checked: boolean) => {
        setMultiStage(checked);
        try {
            if (checked) {
                const steps = treeItemsToFlow(shortTree.items, 'flow');
                const singleStage = { id: 'stage_1', steps };
                update && update({ stages: [singleStage], steps: undefined });
            } else {
                const stagesFlow = treeItemsToFlow(shortTree.items, 'flow');
                const steps = flattenStagesToSteps(stagesFlow);
                update && update({ steps, stages: undefined });
            }
        } catch (e) {
            console.error('Failed to toggle multistage:', e);
        }
    };

    const syncEditorWithTreeExpand = (item: any, open: boolean) => {
        try {
            const parsed = JSON.parse(item.data);
            if (isFolderWithUnifiedExpand(parsed?.type)) {
                setOpenEditors(prev => ({ ...prev, [String(item.index)]: open }));
            }
        } catch { }
    };

    const handleExpand = (item: any, treeId: string) => {
        if (treeId !== 'tree-1') return;
        setExpandedItems(prev => (prev.includes(item.index) ? prev : [...prev, item.index]));
        syncEditorWithTreeExpand(item, true);
    };

    const handleCollapse = (item: any, treeId: string) => {
        if (treeId !== 'tree-1') return;
        setExpandedItems(prev => prev.filter(i => i !== item.index));
        syncEditorWithTreeExpand(item, false);
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
            const t = target as DraggingPositionBetweenItems;
            const parentKey = t.parentItem;
            const siblings = itemsCopy[parentKey].children;
            const childIndex = t.childIndex;
            // Adjust insertion index when dragging within the same parent to a later position
            const originalSiblings: string[] = (shortTree.items[parentKey]?.children) || [];
            const removedBefore = draggedItems.reduce((acc, di) => {
                const wasSameParent = originalSiblings.includes(di.index);
                if (wasSameParent) {
                    const origIdx = originalSiblings.indexOf(di.index);
                    if (origIdx >= 0 && origIdx < childIndex) return acc + 1;
                }
                return acc;
            }, 0);
            const insertIdx = Math.max(0, Math.min(childIndex - removedBefore, siblings.length));
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

        // Ensure dragged items are marked inactive (close circle) after move
        setOpenEditors(prev => {
            const next = { ...prev } as Record<string, boolean>;
            draggedItems.forEach(di => { delete next[String(di.index)]; });
            return next;
        });

        if (target.targetType === 'item') {
            setExpandedItems(prev => (prev.includes(String(target.targetItem)) ? prev : [...prev, String(target.targetItem)]));
        } else if (target.targetType === 'between-items') {
            const parentItem = (target as DraggingPositionBetweenItems).parentItem;
            if (parentItem) {
                setExpandedItems(prev => (prev.includes(String(parentItem)) ? prev : [...prev, String(parentItem)]));
            }
        }
    };

    const createDefaultStep = (type: FlowType | 'data'): any => {
        switch (type) {
            case 'print': return { print: '' };
            case 'call': return { call: '', id: '', inputs: {} };
            case 'http': return { http: '', method: 'get', format: 'json' };
            case 'js': return { js: '' };
            case 'set': return { set: {} };
            case 'var': return { var: {} };
            case 'const': return { const: {} };
            case 'let': return { let: {} };
            case 'setenv': return { setenv: {} };
            case 'check': return { check: '1 == 1' };
            case 'assert': return { assert: '1 == 1' };
            case 'if': return { if: '1 != 1', steps: [] };
            case 'for': return { for: '', steps: [] };
            case 'repeat': return { repeat: 2, steps: [] };
            case 'delay': return { delay: '1s' };
            case 'run': return { run: '' };
            case 'judge': return {
                judge: '',
                context: { actual: '', question: '' },
                expect: {
                    answerRelevance: 0.8,
                    semanticSimilarity: 0.8,
                },
            };
            case 'stage': return { id: 'stage_1', steps: [{ print: 'stage 1' }] };
            default: return { print: '' };
        }
    };

    const addItemOfType = (type: FlowType) => {
        const itemsCopy = { ...shortTree.items } as Record<string, any>;

        const makeNode = (key: string, stepObj: any) => {
            const stepType = getTestFlowStepType(stepObj);
            return {
                index: key,
                isFolder: isTypeFolder(stepType),
                canMove: true,
                children: [],
                data: JSON.stringify({ type: stepType, data: { stepData: stepObj } }),
                canRename: true,
            };
        };

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
            itemsCopy[parentKey] = { ...parent, children, isFolder: true };
        };

        let insertParentKey = 'flow';
        if (multiStage && type !== 'stage') {
            const stageKeys: string[] = itemsCopy.flow?.children || [];
            if (stageKeys.length > 0) {
                insertParentKey = stageKeys[stageKeys.length - 1];
            } else {
                const stageKey = uniqueKey('flow');
                itemsCopy[stageKey] = {
                    index: stageKey,
                    isFolder: true,
                    canMove: true,
                    children: [],
                    data: JSON.stringify({
                        type: 'stage',
                        data: { stepData: createDefaultStep('stage') },
                    }),
                    canRename: true,
                };
                itemsCopy.flow = {
                    ...itemsCopy.flow,
                    children: [...(itemsCopy.flow?.children || []), stageKey],
                };
                insertParentKey = stageKey;
            }
        }

        insertUnder(insertParentKey);
        setShortTree({ items: itemsCopy });

        if (insertParentKey !== 'flow') {
            setExpandedItems(prev => (prev.includes(insertParentKey) ? prev : [...prev, insertParentKey]));
            setOpenEditors(prev => ({ ...prev, [insertParentKey]: true }));
        }

        try {
            const flow = treeItemsToFlow(itemsCopy, 'flow');
            const patch = multiStage ? { stages: flow } : { steps: flow };
            update && update(patch);
        } catch (e) {
            console.error('Failed to convert tree to flow after add:', e);
        }
    };

    return (
        <div className="test-flow-tree" ref={treeRootRef}>
            <ControlledTreeEnvironment
                items={shortTree.items}
                getItemTitle={item => item.data}
                renderDepthOffset={TREE_DEPTH_OFFSET}
                canSearch={false}
                canSearchByStartingTyping={false}
                viewState={{
                    'tree-1': {
                        expandedItems
                    }
                }}
                onExpandItem={handleExpand}
                onCollapseItem={handleCollapse}
                canDragAndDrop={true}
                canDropOnFolder={true}
                canReorderItems={true}
                onDrop={handleDrop}
                onSelectItems={() => { }}
                renderItemArrow={({ item, context }) => (
                    <TreeFolderArrow
                        isFolder={!!item.isFolder}
                        isExpanded={context.isExpanded}
                        arrowProps={context.arrowProps}
                        tall
                        leaf={(() => {
                            let t: string | undefined;
                            try {
                                const parsed = JSON.parse(item.data as string);
                                t = parsed?.type;
                            } catch { }
                            const ico = `codicon-${codiconForStepType(t)}`;
                            return (
                                <span
                                    className="test-flow-leaf-icon"
                                    aria-hidden
                                >
                                    <span className={`codicon ${ico} test-flow-step-icon`} />
                                </span>
                            );
                        })()}
                    />
                )}
                renderItem={({ title, arrow, context, item, children, depth }) => {
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
                            // Keep captures for mouse/focus so tree doesn't grab focus/drag; allow keydown to reach inputs
                            onMouseDownCapture={stopAll}
                            // onClickCapture={stopAll}
                            onFocusCapture={stopAll}
                            // Stop key events at bubble so tree remains inert, but inputs still get onKeyDown
                            onKeyDown={stopAll}
                            onKeyUp={stopAll}
                            onInputCapture={stopAll}
                            className="field-grow"
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
                        try {
                            const node = shortTree.items[targetKey];
                            if (node) {
                                const parsed = JSON.parse(node.data);
                                if (parsed?.type === 'else') {
                                    return;
                                }
                            }
                        } catch {
                        }
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
                        try {
                            const node = shortTree.items[targetKey];
                            if (node) {
                                const parsed = JSON.parse(node.data);
                                if (parsed?.type === 'else') {
                                    return;
                                }
                            }
                        } catch {
                        }
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

                    const expandable = isExpandable(itemParsed.type);
                    const folderExpandable = isFolderWithUnifiedExpand(itemParsed.type);
                    const itemKey = String(item.index);
                    const isTreeExpanded = expandedItems.includes(itemKey);
                    const isOpen = folderExpandable ? isTreeExpanded : !!openEditors[itemKey];
                    const toggleOpen = () => {
                        setOpenEditors(prev => ({ ...prev, [itemKey]: !prev[itemKey] }));
                    };
                    const isFlowRoot = itemParsed.type === 'flow' || itemParsed.type === 'root';

                    if (isFlowRoot) {
                        return (
                            <TreeDepthContainer context={context} depth={depth}>
                                <TestFlowFlow
                                    arrow={arrow}
                                    multiStage={multiStage}
                                    onToggleMultiStage={toggleMultiStage}
                                    onAddItem={addItemOfType}
                                    itemContainerWithoutChildrenProps={context.itemContainerWithoutChildrenProps}
                                />
                                {children}
                            </TreeDepthContainer>
                        );
                    }

                    return (
                        <TreeDepthContainer
                            context={context}
                            depth={depth}
                        >
                        <div
                            onDragStart={(e) => {
                                beginFlowDrag();
                                setTransparentDragImage(e.dataTransfer);
                            }}
                            onDragEnd={endFlowDrag}
                        >
                            <div
                                className={`tree-view-box${(expandable && isOpen && !isFlowDragging) ? ' active' : ''}`}
                                {...context.itemContainerWithoutChildrenProps}
                            >
                                {expandable && !folderExpandable && (
                                    <TreeExpandButton open={isOpen} onToggle={toggleOpen} />
                                )}
                                {arrow}
                                <NoTreeInterference>
                                    <div className="field-grow">
                                        <TestFlowBox
                                            data={{
                                                type: itemParsed.type as FlowType,
                                                stepData: itemParsed.data.stepData,
                                                testData,
                                            }}
                                            importValidation={importValidation}
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
                                            expanded={isOpen}
                                            onDuplicate={() => doDuplicate(String(item.index))}
                                            onRemove={() => doRemove(String(item.index))}
                                        />
                                    </div>
                                </NoTreeInterference>
                                <span
                                    {...context.interactiveElementProps}
                                    title="Drag to reorder"
                                    onMouseDownCapture={(e) => e.stopPropagation()}
                                    onPointerDownCapture={(e) => {
                                        e.stopPropagation();
                                        beginFlowDrag();
                                    }}
                                    className={['tree-grip', 'is-flow', context.interactiveElementProps?.className].filter(Boolean).join(' ')}
                                >
                                    <span className="codicon codicon-gripper" aria-hidden />
                                </span>
                            </div>
                            {children}
                        </div>
                        </TreeDepthContainer>
                    );
                }}
                renderTreeContainer={({ children, containerProps }) => <div {...containerProps}>{children}</div>}
                renderItemsContainer={({ children, containerProps }) => (
                    <ul
                        {...containerProps}
                        className={['tree-list', containerProps.className].filter(Boolean).join(' ')}
                        style={containerProps.style}
                    >
                        {children}
                    </ul>
                )}
                renderDragBetweenLine={({ lineProps, draggingPosition }) => (
                    <div
                        {...lineProps}
                        style={treeDragBetweenLineStyle(lineProps.style, draggingPosition.depth)}
                        className={['tree-drop-line', lineProps.className].filter(Boolean).join(' ')}
                    />
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

    const topIsStages = Array.isArray(testData.stages);

    function toItem(step: any, path: string, forceStageType = false) {
        if (!step) { return; }
        const computed = getTestFlowStepType(step);
        const type = forceStageType ? 'stage' : computed;
        const children: string[] = [];

        if (type === 'if') {
            const thenSteps = Array.isArray(step.steps) ? step.steps : [];
            thenSteps.forEach((childStep: any, idx: number) => {
                if (!childStep) { return; }
                const childPath = `${path}_${idx}`;
                children.push(childPath);
                toItem(childStep, childPath);
            });

            const elseKey = `${path}__else`;
            children.push(elseKey);
            const elseSteps = Array.isArray(step.else) ? step.else : [];
            const elseChildren: string[] = [];
            elseSteps.forEach((childStep: any, idx: number) => {
                if (!childStep) { return; }
                const childPath = `${elseKey}_${idx}`;
                elseChildren.push(childPath);
                toItem(childStep, childPath);
            });
            items[elseKey] = {
                index: elseKey,
                isFolder: true,
                canMove: false,
                children: elseChildren,
                data: JSON.stringify({ type: 'else', data: { stepData: { else: true } } }),
                canRename: false,
            };
        } else {
            const childSteps = (step && Array.isArray(step.steps)) ? step.steps : [];
            childSteps.forEach((childStep: any, idx: number) => {
                if (!childStep) { return; }
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
        if (!step) { return; }
        const key = `flow_${i}`;
        topChildren.push(key);
        // Top-level: if we are in stages mode, mark top items as 'stage'
        toItem(step, key, topIsStages);
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
        canMove: false,
        children: topChildren,
        data: JSON.stringify({ type: "flow", data: { stepData: "Flow" } }),
    };

    return { items };
}

const isTypeFolder = (type: FlowType | unknown): boolean => {
    return type === "stage" || type === "stages" || type === "steps" || type === "if" || type === "else" || type === "for" || type === "repeat";
};

const isExpandable = (type: FlowType | unknown): boolean => {
    return type === "print" || type === "js" || type === "call" || type === "http" || type === "check" || type === "assert" || type === "judge" || type === 'setenv' || type === 'stage' || type === 'if';
};

/** Folder steps with inline editors use one tree chevron for box + nested items. */
const isFolderWithUnifiedExpand = (type: FlowType | unknown): boolean => {
    return isTypeFolder(type) && isExpandable(type);
};

export default TestFlow;

/** Flatten multistage flow into a single steps list (stage wrappers removed). */
export function flattenStagesToSteps(stages: TestFlowSteps | unknown[]): TestFlowSteps {
    if (!Array.isArray(stages)) {
        return [] as TestFlowSteps;
    }
    return stages.flatMap((stage) => (
        Array.isArray((stage as { steps?: unknown[] })?.steps)
            ? (stage as { steps: TestFlowSteps }).steps
            : []
    ));
}

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
    const type = parsed.type;
    const kids: string[] = Array.isArray(node.children) ? node.children : [];

    if (type === 'else') {
        // Structural folder only; never emitted as a flow step.
        return {};
    }

    if (type === 'if') {
        const elseKey = kids.find((k) => {
            try {
                return JSON.parse(items[k]?.data || '{}').type === 'else';
            } catch {
                return false;
            }
        });
        const thenKeys = kids.filter((k) => k !== elseKey);
        const result: any = {
            ...base,
            if: base.if,
            steps: thenKeys.map((k) => buildStepFromTree(items, k)),
        };
        delete result.else;
        if (elseKey) {
            const elseKids: string[] = Array.isArray(items[elseKey]?.children)
                ? items[elseKey].children
                : [];
            if (elseKids.length > 0) {
                result.else = elseKids.map((k: string) => buildStepFromTree(items, k));
            }
        }
        return result;
    }

    if (type === 'for' || type === 'repeat' || type === 'stage') {
        return {
            ...base,
            steps: kids.map((k) => buildStepFromTree(items, k)),
        };
    }

    if (kids.length > 0) {
        const newSteps = kids.map((k) => buildStepFromTree(items, k));
        return { ...base, steps: newSteps };
    }
    return base;
}
