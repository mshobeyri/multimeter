import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { TestData } from "mmt-core/TestData";
import { JSONRecord } from "mmt-core/CommonData";
import TestOverview from "./TestOverview";
import TestFlow from "./TestFlow";
import { yamlToTest, testToYaml } from "mmt-core/testParsePack";
import TestCode from "./TestCode";
import { useImportValidation } from "../text/useImportValidation";
import TestTest from "./TestTest";
import { FileContext } from "../fileContext";
import { FlowchartView } from "../flowchart";
import UnsavedChangesWarning from "../api/UnsavedChangesWarning";
import { showYamlUiConflictDialog } from "../vsAPI";
import {
  modifiedInputKeysLabel,
} from "./testUiRefresh";
import TabBar from "../components/TabBar";
import PanelRunHeader, { HeaderAction } from "../components/PanelRunHeader";
import PanelEditHeader from "../components/PanelEditHeader";

interface TestPanelProps {
  content: string;
  setContent: (value: string, options?: { force?: boolean }) => void;
  parseTest?: (value: string) => TestData;
  onSaveAsMmt?: (test: TestData) => void;
}

const LAST_TAB_KEY = "mmtview:lastTab";
const LAST_TEST_PAGE_KEY = "mmtview:test:lastPage";
type TestPage = "test" | "edit" | "flow";

const TEST_EDIT_TABS = [
  { id: "overview" as const, label: "Overview", icon: "search" },
  { id: "flow" as const, label: "Flow", icon: "list-tree" },
  { id: "code" as const, label: "Code", icon: "code" },
];

function pageTranslate(page: TestPage): string {
  if (page === "edit") {
    return "translateX(-33.333333%)";
  }
  if (page === "flow") {
    return "translateX(-66.666667%)";
  }
  return "translateX(0%)";
}

const TestPanel: React.FC<TestPanelProps> = ({ content, setContent, parseTest = yamlToTest, onSaveAsMmt }) => {
  // `appliedContent` is what the right-side test UI is built from.
  // When the runner has temporary input edits, YAML changes are held until the
  // user resolves the native VS Code conflict dialog — same as APIPanel.
  const [appliedContent, setAppliedContent] = useState(content);
  const resetAfterApplyRef = useRef(false);
  const pendingYamlRef = useRef<string | null>(null);
  const dialogOpenRef = useRef(false);
  const dismissedYamlRef = useRef<string | null>(null);

  const test = useMemo(() => parseTest(appliedContent), [appliedContent, parseTest]);
  const testRef = React.useRef<TestData>(test);
  const contentRef = React.useRef(content);
  const isReadOnly = !!onSaveAsMmt;

  const [tempInputs, setTempInputs] = useState<JSONRecord>({});
  const [dirtyInputKeys, setDirtyInputKeys] = useState<Set<string>>(new Set());

  const handleInputsModificationChange = useCallback(
    (currentInputs: JSONRecord, dirtyKeys: Set<string>) => {
      setTempInputs(currentInputs);
      setDirtyInputKeys(dirtyKeys);
    },
    []
  );

  const resetRef = useRef<(() => void) | null>(null);
  const handleInputsReset = useCallback((reset: () => void) => {
    resetRef.current = reset;
  }, []);

  useEffect(() => {
    testRef.current = test;
  }, [test]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const setTest = React.useCallback((next: TestData | ((prev: TestData) => TestData)) => {
    const resolved = typeof next === "function" ? (next as (prev: TestData) => TestData)(testRef.current) : next;
    testRef.current = resolved;
    const newYaml = testToYaml(resolved);
    if (newYaml === contentRef.current && newYaml === appliedContent) {
      return;
    }
    // UI-originated writes are intentional — apply immediately on both sides.
    dismissedYamlRef.current = null;
    pendingYamlRef.current = null;
    contentRef.current = newYaml;
    setAppliedContent(newYaml);
    setContent(newYaml, { force: true });
  }, [setContent, appliedContent]);

  const hasUiOverrides = dirtyInputKeys.size > 0;

  const [page, setPage] = useState<TestPage>(
    () => (localStorage.getItem(LAST_TEST_PAGE_KEY) as TestPage) || "test"
  );
  const [tab, setTab] = useState<"overview" | "flow" | "code">(
    () => (localStorage.getItem(LAST_TAB_KEY) as "overview" | "flow" | "code") || "overview"
  );
  const { mmtFilePath } = React.useContext(FileContext);

  const isTestModified = page === "test" && hasUiOverrides;

  const savedModifiedTest = useMemo<TestData>(() => {
    if (!hasUiOverrides) {
      return test;
    }
    return {
      ...test,
      inputs: { ...(test.inputs || {}), ...tempInputs },
    } as TestData;
  }, [hasUiOverrides, test, tempInputs]);

  const modifiedYaml = useMemo(
    () => (hasUiOverrides ? testToYaml(savedModifiedTest) : ""),
    [hasUiOverrides, savedModifiedTest]
  );

  const modifiedFieldsLabel = useMemo(
    () => modifiedInputKeysLabel(dirtyInputKeys),
    [dirtyInputKeys]
  );

  const modifiedFieldsLabelRef = useRef(modifiedFieldsLabel);
  const modifiedYamlRef = useRef(modifiedYaml);
  const savedModifiedTestRef = useRef(savedModifiedTest);

  useEffect(() => {
    modifiedFieldsLabelRef.current = modifiedFieldsLabel;
  }, [modifiedFieldsLabel]);

  useEffect(() => {
    modifiedYamlRef.current = modifiedYaml;
  }, [modifiedYaml]);

  useEffect(() => {
    savedModifiedTestRef.current = savedModifiedTest;
  }, [savedModifiedTest]);

  const applyYamlAndResetUi = useCallback((yaml: string) => {
    resetAfterApplyRef.current = true;
    dismissedYamlRef.current = null;
    pendingYamlRef.current = null;
    setAppliedContent(yaml);
  }, []);

  const promptConflict = useCallback(async () => {
    if (dialogOpenRef.current) {
      return;
    }
    dialogOpenRef.current = true;
    try {
      const choice = await showYamlUiConflictDialog(modifiedFieldsLabelRef.current, "test");
      const yaml = pendingYamlRef.current ?? contentRef.current;

      if (choice === "ui-to-yaml") {
        applyYamlAndResetUi(yaml);
        return;
      }

      if (choice === "yaml-to-ui") {
        const uiYaml = modifiedYamlRef.current || testToYaml(savedModifiedTestRef.current);
        resetAfterApplyRef.current = true;
        dismissedYamlRef.current = null;
        pendingYamlRef.current = null;
        setAppliedContent(uiYaml);
        setContent(uiYaml, { force: true });
        return;
      }

      // Cancel (or dialog dismissed): leave both sides as they are.
      dismissedYamlRef.current = yaml;
      pendingYamlRef.current = null;
    } finally {
      dialogOpenRef.current = false;
    }
  }, [applyYamlAndResetUi, setContent]);

  // Gate YAML → UI updates when the runner has temporary input edits.
  useEffect(() => {
    if (content === appliedContent) {
      dismissedYamlRef.current = null;
      pendingYamlRef.current = null;
      return;
    }

    if (!hasUiOverrides) {
      dismissedYamlRef.current = null;
      pendingYamlRef.current = null;
      setAppliedContent(content);
      return;
    }

    if (dismissedYamlRef.current === content) {
      return;
    }

    pendingYamlRef.current = content;
    if (dialogOpenRef.current) {
      return;
    }

    void promptConflict();
  }, [content, appliedContent, hasUiOverrides, promptConflict]);

  // After resolving a conflict by applying new YAML, clear temporary inputs.
  useEffect(() => {
    if (!resetAfterApplyRef.current) {
      return;
    }
    resetAfterApplyRef.current = false;
    resetRef.current?.();
  }, [test]);

  const handleWarningReset = useCallback(() => {
    const stored = appliedContent;
    dismissedYamlRef.current = null;
    pendingYamlRef.current = null;
    setTempInputs({});
    setDirtyInputKeys(new Set());
    setAppliedContent(stored);
    setContent(stored, { force: true });
    resetRef.current?.();
  }, [appliedContent, setContent]);

  const importsMap = React.useMemo(() => {
    const raw = test?.import;
    if (!raw || typeof raw !== "object") {
      return {} as Record<string, string>;
    }
    const sanitized: Record<string, string> = {};
    for (const [alias, value] of Object.entries(raw)) {
      if (typeof alias === "string" && typeof value === "string" && alias.trim() && value.trim()) {
        sanitized[alias] = value;
      }
    }
    return sanitized;
  }, [test]);

  const { missingImports, inputsByAlias, outputsByAlias } = useImportValidation(importsMap);

  useEffect(() => {
    localStorage.setItem(LAST_TAB_KEY, tab);
  }, [tab]);

  useEffect(() => {
    localStorage.setItem(LAST_TEST_PAGE_KEY, page);
  }, [page]);

  useEffect(() => {
    if (isReadOnly && page === 'edit') {
      setPage('test');
    }
  }, [page, isReadOnly]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg && typeof msg === 'object' && msg.command === 'switchToCodeTab') {
        if (isReadOnly) {
          return;
        }
        setPage('edit');
        setTab('code');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isReadOnly]);

  return (
    <div className="panel">
      <div className="panel-box" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div className="api-swipe-root" style={{ flex: 1, minHeight: 0 }}>
          <div
            className="api-swipe-track api-swipe-track--three"
            style={{ transform: pageTranslate(page) }}
          >
            <div className="api-swipe-page api-swipe-page--test">
              <div
                className={isTestModified ? "mmt-working-copy" : undefined}
                style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden", flexDirection: 'column' }}
              >
                <PanelRunHeader
                  icon="beaker"
                  title={test.title || 'Test'}
                  actions={
                    <>
                      <HeaderAction
                        icon="type-hierarchy-sub"
                        label="Flow chart"
                        onClick={() => setPage('flow')}
                      />
                      {onSaveAsMmt ? (
                        <HeaderAction
                          icon="save-as"
                          label="Save as MMT"
                          onClick={() => onSaveAsMmt(test)}
                        />
                      ) : !isTestModified ? (
                        <HeaderAction
                          icon="edit"
                          label="Edit Test"
                          onClick={() => setPage('edit')}
                        />
                      ) : null}
                      {isTestModified && (
                        <UnsavedChangesWarning
                          originalYaml={appliedContent}
                          modifiedYaml={modifiedYaml}
                          onSave={() => setTest(savedModifiedTest)}
                          onReset={handleWarningReset}
                        />
                      )}
                    </>
                  }
                />
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <TestTest
                    testData={test}
                    onInputsModificationChange={handleInputsModificationChange}
                    onInputsReset={handleInputsReset}
                  />
                </div>
              </div>
            </div>

            <div className="api-swipe-page api-swipe-page--edit">
              <PanelEditHeader
                title="Edit Test"
                onBack={() => setPage('test')}
                backTitle="Back to Test"
              >
                <TabBar tabs={TEST_EDIT_TABS} value={tab} onChange={setTab} />
              </PanelEditHeader>

              <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                {!isReadOnly && tab === "overview" && (
                  <TestOverview
                    test={test}
                    update={(patch) => setTest(prev => ({ ...prev, ...patch }))}
                    missingImports={missingImports}
                />
              )}
              {!isReadOnly && tab === "flow" && (
                <TestFlow
                  testData={test}
                  importValidation={{ missingImports, inputsByAlias, outputsByAlias }}
                  update={(patch) => {
                    setTest(prev => {
                      const next = { ...prev } as any;
                      if (patch.stages) {
                        next.stages = patch.stages;
                        delete next.steps;
                      } else if (patch.steps) {
                        next.steps = patch.steps;
                        delete next.stages;
                      }
                      return next;
                    });
                  }}
                />
              )}
                {!isReadOnly && tab === "code" && <TestCode testData={test} />}
              </div>
            </div>

            <div className="api-swipe-page api-swipe-page--flow">
              <FlowchartView
                source={{ kind: 'test', test, filePath: mmtFilePath }}
                onBack={() => setPage('test')}
                title={test.title || 'Test'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPanel;
