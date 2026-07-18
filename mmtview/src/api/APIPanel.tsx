import { yamlToAPI, apiToYaml } from "mmt-core/apiParsePack";
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import APIOverview from "./APIOverview";
import InterfaceEditor from "./APIInterface";
import APIExample from "./APIExample";
import APITest from "./APITester";
import UnsavedChangesWarning from "./UnsavedChangesWarning";
import { APIData, ExampleData } from "mmt-core/APIData";
import { Request } from "mmt-core/NetworkData";
import { protocolResolver } from "mmt-core";
import { safeList, safeListCopy } from "mmt-core/safer";
import { useResolvedYamlContent } from "../useResolvedYamlContent";
import { showYamlUiConflictDialog } from "../vsAPI";

const LAST_API_TAB_KEY = "mmtview:api:lastTab";
const LAST_API_PAGE_KEY = "mmtview:api:lastPage";

const REQUEST_FIELD_LABELS: Partial<Record<keyof Request, string>> = {
  url: "URL",
  query: "Params",
  body: "Body",
  headers: "Headers",
  cookies: "Cookies",
  method: "Method",
  protocol: "Protocol",
  format: "Format",
  graphql: "GraphQL",
  grpc: "gRPC",
  timeout: "Timeout",
};

interface APIsProps {
  content: string;
  setContent: (value: string, options?: { force?: boolean }) => void;
}

const APIs: React.FC<APIsProps> = ({ content, setContent }) => {
  // `appliedContent` is what the right-side API UI is built from.
  // When the tester has temporary edits, YAML changes are held until the
  // user resolves the native VS Code conflict dialog.
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
  const [showIconsOnly, setShowIconsOnly] = useState(false);
  const tabContainerRef = useRef<HTMLDivElement>(null);

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
    const newYaml = apiToYaml(newApi);
    // UI-originated writes are intentional — apply immediately on both sides.
    dismissedYamlRef.current = null;
    pendingYamlRef.current = null;
    setAppliedContent(newYaml);
    setContent(newYaml, { force: true });
  };

  // Build the API as it would look with the user's tester overrides applied.
  // Only fields explicitly touched by the user become overrides.
  const modifiedApi = useMemo<APIData>(() => {
    if (!testRequestData || testTouchedFields.size === 0) {
      return api;
    }
    const overrides: Record<string, unknown> = {};
    testTouchedFields.forEach((field) => {
      overrides[field as string] = (testRequestData as Record<string, unknown>)[field as string];
    });
    return { ...api, ...overrides } as APIData;
  }, [api, testRequestData, testTouchedFields]);

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
      const reqVal = (testRequestData as Record<string, unknown>)[fieldKey];
      const apiVal = (api as unknown as Record<string, unknown>)[fieldKey];
      if (JSON.stringify(reqVal) !== JSON.stringify(apiVal)) {
        modified = true;
      }
    });
    return modified;
  }, [api, testRequestData, testTouchedFields]);

  const isTestModified = page === "test" && hasUiOverrides;

  const modifiedYaml = useMemo(
    () => (hasUiOverrides ? apiToYaml(savedModifiedApi) : ""),
    [hasUiOverrides, savedModifiedApi]
  );

  const modifiedFieldsLabel = useMemo(() => {
    if (!testRequestData || testTouchedFields.size === 0) {
      return "";
    }
    const labels: string[] = [];
    testTouchedFields.forEach((field) => {
      const fieldKey = field as string;
      const reqVal = (testRequestData as Record<string, unknown>)[fieldKey];
      const apiVal = (api as unknown as Record<string, unknown>)[fieldKey];
      if (JSON.stringify(reqVal) !== JSON.stringify(apiVal)) {
        labels.push(REQUEST_FIELD_LABELS[field] || fieldKey);
      }
    });
    return labels.join(", ");
  }, [api, testRequestData, testTouchedFields]);

  const modifiedFieldsLabelRef = useRef(modifiedFieldsLabel);
  const modifiedYamlRef = useRef(modifiedYaml);
  const savedModifiedApiRef = useRef(savedModifiedApi);
  const contentRef = useRef(content);

  useEffect(() => {
    modifiedFieldsLabelRef.current = modifiedFieldsLabel;
  }, [modifiedFieldsLabel]);

  useEffect(() => {
    modifiedYamlRef.current = modifiedYaml;
  }, [modifiedYaml]);

  useEffect(() => {
    savedModifiedApiRef.current = savedModifiedApi;
  }, [savedModifiedApi]);

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
      const choice = await showYamlUiConflictDialog(modifiedFieldsLabelRef.current);
      const yaml = pendingYamlRef.current ?? contentRef.current;

      if (choice === "ui-to-yaml") {
        applyYamlAndResetUi(yaml);
        return;
      }

      if (choice === "yaml-to-ui") {
        const uiYaml = modifiedYamlRef.current || apiToYaml(savedModifiedApiRef.current);
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
    const pending = pendingYamlRef.current;
    if (pending !== null) {
      applyYamlAndResetUi(pending);
      return;
    }
    resetRef.current?.();
  }, [applyYamlAndResetUi]);

  useEffect(() => {
    localStorage.setItem(LAST_API_PAGE_KEY, page);
  }, [page]);

  useEffect(() => {
    localStorage.setItem(LAST_API_TAB_KEY, tab);
  }, [tab]);

  useEffect(() => {
    const checkTabWidth = () => {
      if (!tabContainerRef.current) return;

      const container = tabContainerRef.current;
      const containerWidth = container.clientWidth;

      const fullTextWidth = 4 * 100;

      setShowIconsOnly(containerWidth < fullTextWidth);
    };

    checkTabWidth();

    const resizeObserver = new ResizeObserver(checkTabWidth);
    if (tabContainerRef.current) {
      resizeObserver.observe(tabContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        className="action-button"
                        onClick={() => setPage('edit')}
                        title="Edit API"
                        type="button"
                      >
                        <span className="codicon codicon-edit" aria-hidden />
                        <span className="api-edit-launcher-text">Edit API</span>
                      </button>
                      {isTestModified && (
                        <UnsavedChangesWarning
                          modifiedYaml={modifiedYaml}
                          onSave={() => setAPI(savedModifiedApi)}
                          onReset={handleWarningReset}
                        />
                      )}
                    </div>
                  }
                />
              </div>
            </div>

            <div className="api-swipe-page api-swipe-page--edit">
              <div className="api-edit-header">
                <div className="api-edit-header-row">
                  <button
                    className="action-button"
                    onClick={() => setPage('test')}
                    title="Back to Test"
                    type="button"
                  >
                    <span className="codicon codicon-arrow-left" aria-hidden />
                  </button>
                  <div className="api-edit-title">Edit API</div>
                </div>
                <div ref={tabContainerRef} className="tab-bar">
                  <button
                    onClick={() => setTab('overview')}
                    className={`tab-button ${tab === 'overview' ? 'active' : ''}`}
                    title={showIconsOnly ? 'Overview' : undefined}
                    type="button"
                  >
                    <span className="codicon codicon-search tab-button-icon"></span>
                    {!showIconsOnly && 'Overview'}
                  </button>
                  <button
                    onClick={() => setTab('interface')}
                    className={`tab-button ${tab === 'interface' ? 'active' : ''}`}
                    title={showIconsOnly ? 'Interface' : undefined}
                    type="button"
                  >
                    <span className="codicon codicon-symbol-interface tab-button-icon"></span>
                    {!showIconsOnly && 'Interface'}
                  </button>
                  <button
                    onClick={() => setTab('examples')}
                    className={`tab-button ${tab === 'examples' ? 'active' : ''}`}
                    title={showIconsOnly ? 'Examples' : undefined}
                    type="button"
                  >
                    <span className="codicon codicon-lightbulb tab-button-icon"></span>
                    {!showIconsOnly && 'Examples'}
                  </button>
                </div>
              </div>

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
                          <button onClick={addExample} className="button-icon" type="button">
                            <span className="codicon codicon-add" aria-hidden />
                            Add Example
                          </button>
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
