import { yamlToAPI, apiToYaml } from "mmt-core/apiParsePack";
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import APIOverview from "./APIOverview";
import InterfaceEditor from "./APIInterface";
import APIExample from "./APIExample";
import APITest from "./APITester";
import UnsavedChangesWarning from "./UnsavedChangesWarning";
import YamlErrorWarning, { HideWhenYamlError } from "./YamlErrorWarning";
import { APIData, ExampleData } from "mmt-core/APIData";
import { Request } from "mmt-core/NetworkData";
import { protocolResolver } from "mmt-core";
import { requestFormat } from "mmt-core/CommonData";
import { packBodyForYamlCompare } from "mmt-core/markupConvertor";
import { safeList, safeListCopy } from "mmt-core/safer";
import { useResolvedYamlContent } from "../useResolvedYamlContent";
import { showYamlUiConflictDialog } from "../vsAPI";
import TabBar from "../components/TabBar";
import PrimaryButton from "../components/PrimaryButton";
import PanelEditHeader from "../components/PanelEditHeader";
import { HeaderAction } from "../components/PanelRunHeader";

const LAST_API_TAB_KEY = "mmtview:api:lastTab";
const LAST_API_PAGE_KEY = "mmtview:api:lastPage";

const API_EDIT_TABS = [
  { id: "overview" as const, label: "Overview", icon: "search" },
  { id: "interface" as const, label: "Interface", icon: "symbol-interface" },
  { id: "examples" as const, label: "Examples", icon: "lightbulb" },
];

interface APIsProps {
  content: string;
  setContent: (value: string, options?: { force?: boolean }) => void;
}

const APIs: React.FC<APIsProps> = ({ content, setContent }) => {
  // `appliedContent` is what the right-side API UI is built from.
  // When the tester has temporary edits, YAML changes are held until the
  // user discards the UI changes or cancels.
  const [appliedContent, setAppliedContent] = useState(content);
  const resetAfterApplyRef = useRef(false);
  const pendingYamlRef = useRef<string | null>(null);
  const dialogOpenRef = useRef(false);
  const dismissedYamlRef = useRef<string | null>(null);

  const resolvedContent = useResolvedYamlContent(appliedContent);
  const api = useMemo<APIData>(() => yamlToAPI(resolvedContent), [resolvedContent]);

  const [page, setPage] = useState<"test" | "edit">(
    () => (localStorage.getItem(LAST_API_PAGE_KEY) as "test" | "edit") || "test"
  );
  const [tab, setTab] = useState<"overview" | "interface" | "examples">(
    () => (localStorage.getItem(LAST_API_TAB_KEY) as "overview" | "interface" | "examples") || "overview"
  );

  // Test-mode override tracking. We don't snapshot the API on entry; instead
  // we ask the tester which fields the user has touched and compare those
  // values against the current `api`. This way:
  //  - YAML edits don't silently overwrite UI overrides
  //  - Reverting a touched value back to its api value clears the warning
  const [testRequestData, setTestRequestData] = useState<Request | undefined>(undefined);
  const [testTouchedFields, setTestTouchedFields] = useState<Set<keyof Request>>(new Set());

  const handleModificationChange = useCallback(
    (req: Request | undefined, touched: Set<keyof Request>) => {
      setTestRequestData(req);
      setTestTouchedFields(touched);
    },
    []
  );

  const resetRef = useRef<(() => void) | null>(null);

  const handleRequestReset = useCallback((reset: () => void) => {
    resetRef.current = reset;
  }, []);

    const setAPI = (newApi: APIData) => {
    const newYaml = apiToYaml(newApi, appliedContent);
    // UI-originated writes are intentional — apply immediately on both sides.
    dismissedYamlRef.current = null;
    pendingYamlRef.current = null;
    setAppliedContent(newYaml);
    setContent(newYaml, { force: true });
  };

  // Build the API as it would look with the user's tester overrides applied.
  // Only fields explicitly touched by the user become overrides.
  const uiFieldValue = useCallback((field: string): unknown => {
    const raw = (testRequestData as Record<string, unknown> | undefined)?.[field];
    if (field !== "body") {
      return raw;
    }
    return packBodyForYamlCompare(api.body, raw, requestFormat(api.format));
  }, [api.body, api.format, testRequestData]);

  const modifiedApi = useMemo<APIData>(() => {
    if (!testRequestData || testTouchedFields.size === 0) {
      return api;
    }
    const overrides: Record<string, unknown> = {};
    testTouchedFields.forEach((field) => {
      overrides[field as string] = uiFieldValue(field as string);
    });
    return { ...api, ...overrides } as APIData;
  }, [api, testRequestData, testTouchedFields, uiFieldValue]);

  const savedModifiedApi = useMemo<APIData>(() => {
    const effectiveProtocol = protocolResolver.getEffectiveProtocol(modifiedApi.protocol, modifiedApi.url);
    if (effectiveProtocol !== 'http' || modifiedApi.method) {
      return modifiedApi;
    }
    return { ...modifiedApi, method: 'get' } as APIData;
  }, [modifiedApi]);

  const hasUiOverrides = useMemo(() => {
    if (!testRequestData || testTouchedFields.size === 0) {
      return false;
    }
    let modified = false;
    testTouchedFields.forEach((field) => {
      if (modified) { return; }
      const fieldKey = field as string;
      const reqVal = uiFieldValue(fieldKey);
      const apiVal = (api as unknown as Record<string, unknown>)[fieldKey];
      if (JSON.stringify(reqVal) !== JSON.stringify(apiVal)) {
        modified = true;
      }
    });
    return modified;
  }, [api, testRequestData, testTouchedFields, uiFieldValue]);

  const isTestModified = page === "test" && hasUiOverrides;

  const modifiedYaml = useMemo(
    () => (hasUiOverrides ? apiToYaml(savedModifiedApi, appliedContent) : ""),
    [hasUiOverrides, savedModifiedApi, appliedContent]
  );

  const contentRef = useRef(content);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

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
      const choice = await showYamlUiConflictDialog();
      const yaml = pendingYamlRef.current ?? contentRef.current;

      if (choice === "discard-ui") {
        applyYamlAndResetUi(yaml);
        return;
      }

      // Cancel (or dialog dismissed): leave both sides as they are.
      dismissedYamlRef.current = yaml;
      pendingYamlRef.current = null;
    } finally {
      dialogOpenRef.current = false;
    }
  }, [applyYamlAndResetUi]);

  // Gate YAML → UI updates when the tester has temporary edits.
  useEffect(() => {
    if (content === appliedContent) {
      dismissedYamlRef.current = null;
      pendingYamlRef.current = null;
      return;
    }

    // UI overrides were cleared — safe to apply YAML.
    if (!hasUiOverrides) {
      dismissedYamlRef.current = null;
      pendingYamlRef.current = null;
      setAppliedContent(content);
      return;
    }

    // User already cancelled for this exact YAML snapshot.
    if (dismissedYamlRef.current === content) {
      return;
    }

    pendingYamlRef.current = content;
    if (dialogOpenRef.current) {
      return;
    }

    void promptConflict();
  }, [content, appliedContent, hasUiOverrides, promptConflict]);

  // After resolving a conflict by applying new YAML/`api`, clear tester overrides.
  useEffect(() => {
    if (!resetAfterApplyRef.current) {
      return;
    }
    resetAfterApplyRef.current = false;
    resetRef.current?.();
  }, [api]);

  const handleWarningReset = useCallback(() => {
    // Reset both sides to the stored YAML so UI and editor match again.
    const stored = appliedContent;
    dismissedYamlRef.current = null;
    pendingYamlRef.current = null;
    setTestRequestData(undefined);
    setTestTouchedFields(new Set());
    setAppliedContent(stored);
    setContent(stored, { force: true });
    resetRef.current?.();
  }, [appliedContent, setContent]);

  // Save temporary UI into YAML — drop tester overrides so later YAML
  // edits apply to the UI instead of looking like unsaved changes again.
  const handleWarningSave = useCallback(() => {
    const newYaml = apiToYaml(savedModifiedApi, appliedContent);
    resetAfterApplyRef.current = true;
    dismissedYamlRef.current = null;
    pendingYamlRef.current = null;
    setTestRequestData(undefined);
    setTestTouchedFields(new Set());
    setAppliedContent(newYaml);
    setContent(newYaml, { force: true });
    if (newYaml === appliedContent) {
      resetAfterApplyRef.current = false;
      resetRef.current?.();
    }
  }, [appliedContent, savedModifiedApi, setContent]);

  useEffect(() => {
    localStorage.setItem(LAST_API_PAGE_KEY, page);
  }, [page]);

  useEffect(() => {
    localStorage.setItem(LAST_API_TAB_KEY, tab);
  }, [tab]);

  // Helper to update top-level fields
  const update = (patch: Partial<APIData>) => {
    setAPI({ ...api, ...patch });
  };

  // Helper to update a specific interface
  const updateInterface = (patch: Partial<APIData>) => {
    setAPI({ ...api, ...patch });
  };

  const updateExample = (idx: number, patch: Partial<ExampleData>) => {
    setAPI({ ...api, examples: safeListCopy(api.examples).map((example, i) => i === idx ? { ...example, ...patch } : example) });
  };

  const removeExample = (idx: number) => {

    const examples = safeList(api.examples).filter((_, i) => i !== idx);
    setAPI({ ...api, examples });
  };

  const addExample = () => {
    const examples = safeListCopy(api.examples);
    examples.push({ name: "" });
    setAPI({ ...api, examples });
  };

  return (
    <div className="panel" style={{ overflow: 'hidden' }}>
      <div
        className="panel-box"
        style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, marginBottom: 0, overflow: 'hidden' }}
      >
        <div className="api-swipe-root" style={{ flex: 1, minHeight: 0 }}>
          <div
            className="api-swipe-track"
            style={{ transform: page === 'test' ? 'translateX(0%)' : 'translateX(-50%)' }}
          >
            <div className="api-swipe-page api-swipe-page--test">
              <div className="apitest-panel-wrapper">
                <APITest
                  api={api}
                  onUpdateApi={update}
                  onModificationChange={handleModificationChange}
                  onRequestReset={handleRequestReset}
                  rightOfUrlButton={
                    <>
                      <YamlErrorWarning />
                      <HideWhenYamlError>
                        {isTestModified ? (
                          <UnsavedChangesWarning
                            originalYaml={appliedContent}
                            modifiedYaml={modifiedYaml}
                            onSave={handleWarningSave}
                            onReset={handleWarningReset}
                          />
                        ) : (
                          <HeaderAction
                            icon="edit"
                            label="Edit API"
                            onClick={() => setPage('edit')}
                          />
                        )}
                      </HideWhenYamlError>
                    </>
                  }
                />
              </div>
            </div>

            <div className="api-swipe-page api-swipe-page--edit">
              <PanelEditHeader
                title="Edit API"
                onBack={() => setPage('test')}
                backTitle="Back to Test"
              >
                <TabBar tabs={API_EDIT_TABS} value={tab} onChange={setTab} />
              </PanelEditHeader>

              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                {tab === 'overview' && <APIOverview api={api} update={update} />}

                {tab === 'interface' && (
                  <InterfaceEditor
                    data={api}
                    onChange={(updated) => updateInterface(updated)}
                  />
                )}

                {tab === 'examples' && (
                  <table
                    className="APIEditor"
                    style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: 0 }}
                  >
                    <tbody>
                      <tr>
                        <td colSpan={2} style={{ padding: 0 }}>
                          {safeList(api.examples)
                            .filter((ex) => ex != null)
                            .map((example, idx) => (
                              <div key={idx} className="inner-box">
                                <APIExample
                                  data={example}
                                  apiInputs={api.inputs}
                                  apiOutputs={api.outputs}
                                  onChange={(updated) => updateExample(idx, updated)}
                                  onRemove={() => removeExample(idx)}
                                />
                              </div>
                            ))}
                          <PrimaryButton icon="add" onClick={addExample}>
                            Add Example
                          </PrimaryButton>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIs;
