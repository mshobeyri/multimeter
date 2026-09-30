import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { APIData } from "mmt-core/APIData";
import { Request, Response } from "mmt-core/NetworkData";
import { JSONRecord, requestFormat, responseFormat } from "mmt-core/CommonData";
import { resolveRequestFormat } from "mmt-core/formatResolve";
import { safeList } from "mmt-core/safer";
import { fieldForYamlSave, requestForSend } from "mmt-core/apiBodyEdit";
import { formattedBodyToYamlObject } from "mmt-core/markupConvertor";
import { apiToYaml } from "mmt-core/apiParsePack";
import { loadEnvVariables } from "../workspaceStorage";
import { extractOutputs, extractPathAtPosition, buildBodyExprFromPath } from "mmt-core/outputExtractor";
import { resolveSetenvValues } from "mmt-core/setenvResolve";
import { setEnvironmentVariables } from "../environment/environmentUtils";
import { useNetwork } from "../components/network/Network";
import { pushHistory } from "../vsAPI";
import { protocolResolver } from "mmt-core";
import { resolveApiHttpMethod } from "mmt-core/apiMethod";
import { resolveResponseViewType, responseBodyToRawString } from "./responseBodyDisplay";
import {
  cacheBodyAutoFormat,
  readCachedBodyAutoFormat,
  requestEditorConfig,
} from "./bodyAutoFormatConfig";
import {
  ApiUiRefreshScope,
  applyScopedRequestData,
  diffApiRefreshScopes,
  isDocOnlyRefresh,
} from "./apiUiRefresh";
import { resolveApiRequest } from "mmt-core/resolveApiRequest";

/** Always prefer the right-panel API Tester request over file YAML. */
function packUiRequestBody(api: APIData, requestData: Request): unknown {
  const format = resolveRequestFormat(
    requestFormat(requestData.format ?? api.format),
    requestData.headers,
    requestData.method ?? api.method,
  );
  const body = requestData.body;
  if (format !== "multipart") {
    return body;
  }
  if (Array.isArray(body)) {
    return body;
  }
  if (typeof body === "string") {
    const packed = formattedBodyToYamlObject("multipart", body);
    if (Array.isArray(packed)) {
      return packed;
    }
  }
  return body;
}

function buildUiApiRawFile(api: APIData, requestData: Request | undefined): string {
  let merged = api;
  if (requestData) {
    const overrides: Record<string, unknown> = {};
    (Object.keys(requestData) as (keyof Request)[]).forEach((field) => {
      const val = requestData[field];
      if (val !== undefined) {
        overrides[field as string] = val;
      }
    });
    merged = { ...api, ...overrides } as APIData;
    merged.body = packUiRequestBody(api, requestData) as APIData["body"];
    // prepareRequestData already applied auth into headers/query.
    delete (merged as { auth?: unknown }).auth;
  }
  const effectiveProtocol = protocolResolver.getEffectiveProtocol(
    merged.protocol, merged.url);
  if (effectiveProtocol === "http" && !merged.method) {
    merged = {
      ...merged,
      method: resolveApiHttpMethod(undefined, merged.body),
    };
  }
  return apiToYaml(merged);
}

type OutputPosition = { text?: string; line: number; column: number };

interface UseAPITesterLogicParams {
  api: APIData;
  onUpdateApi?: (patch: Partial<APIData>) => void;
  filePath?: string;
  initialExampleIndex?: number;
}

function clampExampleIndex(examples: unknown[] | undefined, index: number | undefined): number {
  if (typeof index !== "number" || index < 0) {
    return -1;
  }
  const list = safeList(examples);
  if (index >= list.length) {
    return -1;
  }
  return index;
}

export function useAPITesterLogic({ api, onUpdateApi, filePath, initialExampleIndex }: UseAPITesterLogicParams) {
  const [autoFormatBody, setAutoFormatBodyState] = useState<boolean>(() => readCachedBodyAutoFormat());
  const autoFormatBodyRef = useRef(autoFormatBody);
  autoFormatBodyRef.current = autoFormatBody;
  const network = useNetwork(autoFormatBody);
  const apiRef = useRef<APIData>(api);
  const [requestData, setRequestData] = useState<Request>();
  const requestDataRef = useRef(requestData);
  requestDataRef.current = requestData;
  const [isSending, setIsSending] = useState(false);
  const sendPendingRef = useRef(false);
  const [responseData, setResponseData] = useState<Response>();
  const [responseRevision, setResponseRevision] = useState<number>(0);
  const [selectedExampleIdx, setSelectedExampleIdx] = useState<number>(
    () => clampExampleIndex(api.examples, initialExampleIndex)
  );
  const prevApiRef = useRef<APIData | undefined>(undefined);
  const prevExampleIdxRef = useRef<number>(
    clampExampleIndex(api.examples, initialExampleIndex)
  );
  const [currentInputs, setCurrentInputs] = useState<JSONRecord>({});
  const currentInputsRef = useRef<JSONRecord>({});
  const [envValues, setEnvValues] = useState<JSONRecord>({});
  const touchedFieldsRef = useRef<Set<keyof Request>>(new Set());
  const [touchedFields, setTouchedFields] = useState<Set<keyof Request>>(new Set());
  const [outputs, setOutputs] = useState<JSONRecord>({});
  const [setenvValues, setSetenvValues] = useState<JSONRecord>({});
  const [apiTestResults, setApiTestResults] = useState<import("mmt-core/apiTestEval").ApiTestExpectItem[] | null>(null);

  const examples = useMemo(() => safeList(api.examples), [api.examples]);

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  useEffect(() => {
    currentInputsRef.current = currentInputs;
  }, [currentInputs]);

  const markFieldTouched = useCallback((field: keyof Request) => {
    if (!touchedFieldsRef.current.has(field)) {
      touchedFieldsRef.current.add(field);
      setTouchedFields(new Set(touchedFieldsRef.current));
    }
  }, []);

  const resetTouchedFields = useCallback(() => {
    if (touchedFieldsRef.current.size > 0) {
      touchedFieldsRef.current.clear();
      setTouchedFields(new Set());
    }
  }, []);

  /** Pack UI edit buffers into YAML forms and write the file immediately. */
  const writeYamlPatch = useCallback((patch: Partial<Request>) => {
    if (!onUpdateApi || Object.keys(patch).length === 0) {
      return;
    }
    const yamlPatch: Partial<APIData> = {};
    (Object.keys(patch) as (keyof Request)[]).forEach((field) => {
      (yamlPatch as Record<string, unknown>)[field as string] = fieldForYamlSave(
        patch[field],
      );
    });
    onUpdateApi(yamlPatch);
  }, [onUpdateApi]);

  /** Update one or more request fields and write them to YAML immediately. */
  const updateFields = useCallback((patch: Partial<Request>) => {
    const keys = Object.keys(patch) as (keyof Request)[];
    if (keys.length === 0) {
      return;
    }
    keys.forEach((field) => markFieldTouched(field));
    setRequestData((prev) => ({
      ...(prev ?? {}),
      ...patch,
    } as Request));
    writeYamlPatch(patch);
  }, [markFieldTouched, writeYamlPatch]);

  const updateField = useCallback((field: keyof Request, value: unknown) => {
    updateFields({ [field]: value } as Partial<Request>);
  }, [updateFields]);

  /** Set a field and drop it from touched (e.g. format reverted to YAML baseline). */
  const restoreField = useCallback((field: keyof Request, value: unknown) => {
    if (touchedFieldsRef.current.has(field)) {
      touchedFieldsRef.current.delete(field);
      setTouchedFields(new Set(touchedFieldsRef.current));
    }
    setRequestData(prev => ({
      ...(prev ?? {}),
      [field]: value
    } as Request));
    writeYamlPatch({ [field]: value } as Partial<Request>);
  }, [writeYamlPatch]);

  const handleUrlChange = useCallback((newUrl: string) => {
    if (newUrl !== requestData?.url) {
      updateFields({ url: newUrl });
    }
  }, [requestData?.url, updateFields]);

  const handleQueryChange = useCallback((query: Record<string, string>) => {
    const prevQuery = JSON.stringify(requestData?.query || {});
    const nextQuery = JSON.stringify(query || {});
    if (prevQuery !== nextQuery) {
      updateFields({ query });
    }
  }, [requestData?.query, updateFields]);

  const loadEnvParameters = useCallback(async (): Promise<JSONRecord> => {
    const envVars = await new Promise<any[]>(resolve => {
      const cleanup = loadEnvVariables(vars => {
        cleanup();
        resolve(vars);
      });
    });

    return safeList(envVars).reduce((acc, envVar) => {
      acc[envVar.name] = envVar.value;
      return acc;
    }, {} as JSONRecord);
  }, []);

  const resolveFreshRequestData = useCallback(async (
    inputs?: JSONRecord,
    options?: { refreshRuntimeTokens?: boolean }
  ): Promise<Request> => {
    const resolvedInputs = inputs ?? currentInputsRef.current;
    const envParameters = await loadEnvParameters();
    setEnvValues(envParameters);
    return resolveApiRequest(
      api,
      resolvedInputs,
      envParameters,
      {
        refreshRuntimeTokens: options?.refreshRuntimeTokens,
        preserveStructuredBody: true,
      }
    );
  }, [api, loadEnvParameters]);

  const prepareRequestData = useCallback((
    inputs?: JSONRecord,
    options?: {
      forceReset?: boolean;
      respectTouched?: boolean;
      /** Which UI parts to rewrite. Default `['all']`. Prefer narrower scopes (`env` / `url` / `body`) for partial updates. */
      scopes?: ApiUiRefreshScope[];
    }
  ) => {
    const scopes: ApiUiRefreshScope[] = options?.scopes ?? ["all"];
    if (isDocOnlyRefresh(scopes)) {
      return;
    }

    if (options?.forceReset) {
      resetTouchedFields();
    }

    const resolvedInputs = inputs ?? currentInputsRef.current;
    const respectTouched = options?.respectTouched ?? true;

    void (async () => {
      const rface = await resolveFreshRequestData(resolvedInputs);
      setRequestData((prev) =>
        applyScopedRequestData(prev, rface, scopes, touchedFieldsRef.current, respectTouched)
      );
    })();
  }, [resetTouchedFields, resolveFreshRequestData]);

  const buildRequestForSend = useCallback(async (): Promise<Request> => {
    const fresh = await resolveFreshRequestData(undefined, { refreshRuntimeTokens: true });
    const merged = applyScopedRequestData(
      requestDataRef.current,
      fresh,
      ["all"],
      touchedFieldsRef.current,
      true
    );
    setRequestData(merged);
    const reqFormat = resolveRequestFormat(
      requestFormat(merged.format ?? apiRef.current.format),
      merged.headers,
      merged.method ?? apiRef.current.method,
    );
    return {
      ...requestForSend(merged, reqFormat),
    };
  }, [resolveFreshRequestData]);

  // Rebuild request UI when YAML/`api` changes. Example dropdown applies inputs
  // itself; input edits only sync the selected index (no reload).
  useEffect(() => {
    const prevApi = prevApiRef.current;
    prevExampleIdxRef.current = selectedExampleIdx;

    let scopes: ApiUiRefreshScope[];
    let forceReset = false;
    let exampleIdx = selectedExampleIdx;

    if (!prevApi) {
      scopes = ["all"];
      forceReset = true;
    } else if (prevApi !== api) {
      scopes = diffApiRefreshScopes(prevApi, api);
      if (scopes.length === 0) {
        prevApiRef.current = api;
        return;
      }

      // Examples / doc-only YAML edits leave the live request alone.
      if (isDocOnlyRefresh(scopes)) {
        prevApiRef.current = api;
        return;
      }

      // Body-only YAML edits (e.g. live token editor): re-resolve body without
      // resetting inputs / example selection.
      if (scopes.length === 1 && scopes[0] === "body") {
        prevApiRef.current = api;
        prepareRequestData(currentInputsRef.current, {
          respectTouched: false,
          scopes: ["body"],
        });
        return;
      }

      // Live tester writes for url/headers/meta (and multi-scope combos of those
      // with body): refresh in place. Keep edit buffers for touched fields so
      // {{…}} display mode survives the YAML echo.
      const liveOnly = scopes.every(
        (s) => s === "url" || s === "body" || s === "headers" || s === "meta" || s === "doc" || s === "examples",
      );
      if (liveOnly && scopes.some((s) => s === "url" || s === "body" || s === "headers" || s === "meta")) {
        prevApiRef.current = api;
        prepareRequestData(currentInputsRef.current, {
          respectTouched: true,
          scopes,
        });
        return;
      }

      // Any other YAML change resets inputs to defaults and clears example
      // selection (Select...), matching preset-style behavior.
      forceReset = true;
      scopes = ["all"];
      exampleIdx = -1;
      if (selectedExampleIdx !== -1) {
        setSelectedExampleIdx(-1);
      }
    } else {
      // Same API: example index sync from inputs must not rewrite inputs.
      return;
    }

    prevApiRef.current = api;

    const baseInputs = exampleIdx === -1
      ? (api.inputs || {})
      : (examples[exampleIdx]?.inputs || {});

    const clonedInputs = cloneInputs(baseInputs);
    setCurrentInputs(clonedInputs);
    prepareRequestData(clonedInputs, { forceReset, scopes });
  }, [api, examples, selectedExampleIdx, prepareRequestData]);

  useEffect(() => {
    const hasBody = !!(responseData?.body && responseData.body !== "");
    const hasHeaders = !!(responseData?.headers && Object.keys(responseData.headers).length > 0);
    const hasCookies = !!(responseData?.cookies && Object.keys(responseData.cookies).length > 0);
    if (!hasBody && !hasHeaders && !hasCookies &&
        (responseData?.status === null || responseData?.status === undefined)) {
      return;
    }

    const extractSource = {
      type: "auto" as const,
      body: responseData?.body,
      headers: responseData?.headers || {},
      cookies: responseData?.cookies || {},
      status: responseData?.status,
      duration: responseData?.duration,
    };

    const extractRules = api.outputs || {};
    const outputNames = Object.keys(extractRules);
    const finalOutputs: JSONRecord = {};

    if (outputNames.length > 0) {
      const extractedValues = extractOutputs(extractSource, extractRules);
      outputNames.forEach(outputName => {
        if (outputName in extractedValues) {
          finalOutputs[outputName] = extractedValues[outputName];
        } else {
          finalOutputs[outputName] = "";
        }
      });
      setOutputs(finalOutputs);
    } else {
      setOutputs({});
    }

    const resolvedSetenv = resolveSetenvValues({
      response: extractSource,
      setenv: api.setenv,
      outputs: api.outputs,
      extractedOutputs: finalOutputs,
    });
    const nextSetenv: JSONRecord = {};
    for (const item of resolvedSetenv) {
      nextSetenv[item.name] = item.value;
    }
    setSetenvValues(nextSetenv);
    void applyResolvedSetenvVariables(api, resolvedSetenv);
  }, [responseData?.body, responseData?.headers, responseData?.cookies, responseData?.status, responseData?.duration, api.outputs, api.setenv, api]);

  const handleAddOutputVariable = useCallback((pos: OutputPosition) => {
    const bodyText = pos.text ?? "";

    const declared = responseFormat(requestData?.format ?? apiRef.current.format);
    const reqFmt = resolveRequestFormat(
      requestFormat(requestData?.format ?? apiRef.current.format),
      requestData?.headers,
      requestData?.method ?? apiRef.current.method,
    );
    const resolved = declared === "auto"
      ? resolveResponseViewType("auto", responseData, reqFmt, requestData?.headers)
      : declared;
    const contentType: "json" | "xml" =
      resolved.includes("xml") || bodyText.trim().startsWith("<")
        ? "xml"
        : "json";
    const path = extractPathAtPosition(bodyText || "", contentType, pos.line, pos.column);
    if (!path || path.length === 0) {
      return;
    }

    const expr = buildBodyExprFromPath(path);
    let suggestedKey = "value";
    for (let i = path.length - 1; i >= 0; i--) {
      const seg = path[i];
      if (typeof seg === "string" && seg.trim()) {
        suggestedKey = seg;
        break;
      }
    }

    const existing = { ...(apiRef.current.outputs || {}) };
    let key = suggestedKey;
    let counter = 1;
    while (Object.prototype.hasOwnProperty.call(existing, key)) {
      key = `${suggestedKey}_${counter++}`;
    }

    existing[key] = expr;
    onUpdateApi?.({ outputs: existing });
  }, [onUpdateApi, requestData?.format, requestData?.headers, responseData]);

  // HTTP/GraphQL/gRPC Send / Run in Core from the right panel: always send the
  // UI request as rawFile. Glyphs omit rawFile and use the editor file only.
  // The extension posts multimeter.api.run.result so the Response panel and
  // finish log share the same network duration. WS still uses the live socket.
  const runViaCore = useCallback((opts: {
    forSend: boolean;
    requestOverride?: Request;
  }) => {
    const req = opts.requestOverride ?? requestDataRef.current;
    if (opts.forSend) {
      setIsSending(true);
      sendPendingRef.current = true;
      const protocol = protocolResolver.getEffectiveProtocol(
        req?.protocol as any, req?.url) || "http";
      const methodRaw = resolveApiHttpMethod(
        req?.method || apiRef.current?.method,
        req?.body ?? apiRef.current?.body);
      const method = typeof methodRaw === "string" ? methodRaw.trim().toLowerCase() : "get";
      const url = req?.url ?? "";
      pushHistory({
        type: "send",
        method: method.toUpperCase(),
        protocol,
        title: url,
        cookies: req?.cookies,
        headers: req?.headers,
        query: req?.query,
        content: method === "get" ? "" : toContentString(req?.body),
      });
    }
    window.vscode?.postMessage({
      command: "runCurrentDocument",
      report: { type: "lifecycle" },
      rawFile: buildUiApiRawFile(apiRef.current, req),
      inputs: {
        exampleIndex: selectedExampleIdx,
        manualInputs: currentInputsRef.current,
      },
    });
  }, [selectedExampleIdx]);

  const handleRunInCore = useCallback(async () => {
    const req = await buildRequestForSend();
    runViaCore({ forSend: false, requestOverride: req });
    window.vscode?.postMessage({ command: "showLogOutputChannel" });
  }, [buildRequestForSend, runViaCore]);

  const handleSend = useCallback(async () => {
    setResponseData(undefined);
    setResponseRevision(prev => prev + 1);
    setApiTestResults(null);

    const req = await buildRequestForSend();
    const protocol = protocolResolver.getEffectiveProtocol(
      req?.protocol as any, req?.url);

    if (protocol === "ws") {
      const res = await network.send(req);
      setResponseData(res);
      setResponseRevision(prev => prev + 1);
      return;
    }

    runViaCore({ forSend: true, requestOverride: req });
  }, [network, buildRequestForSend, runViaCore]);

  const handleCancel = useCallback(async () => {
    const protocol = protocolResolver.getEffectiveProtocol(
      requestDataRef.current?.protocol as any, requestDataRef.current?.url);

    setIsSending(false);
    sendPendingRef.current = false;
    setResponseData(undefined);

    if (protocol === "ws") {
      await network.cancel();
      return;
    }
    window.vscode?.postMessage({ command: "stopTestRun" });
  }, [network]);

  const handleConnect = useCallback(() => {
    setResponseData(undefined);
    if (network.connected) {
      network.closeWs();
    } else {
      network.connectWs(requestData?.url || "").then(setResponseData);
    }
  }, [network, requestData?.url]);

  const setAutoFormatBody = useCallback((next: boolean) => {
    setAutoFormatBodyState(next);
    cacheBodyAutoFormat(next);
  }, []);

  useEffect(() => {
    const handleConfig = (message: any) => {
      if (typeof message.bodyAutoFormat !== "boolean") {
        return;
      }
      cacheBodyAutoFormat(message.bodyAutoFormat);
      // Config is also re-sent on request and after our own toggle, so only a
      // real change should force the request back to the file values.
      if (message.bodyAutoFormat === autoFormatBodyRef.current) {
        return;
      }
      setAutoFormatBodyState(message.bodyAutoFormat);
      prepareRequestData(undefined, { forceReset: true, scopes: ["all"] });
    };

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message) {
        return;
      }
      switch (message.command) {
        case "multimeter.environment.refresh":
          // Env values changed: re-resolve tokens into request text fields only.
          // Do not force-reset the whole tester or clear user edits.
          prepareRequestData(undefined, { scopes: ["env"] });
          break;
        case "config":
          handleConfig(message);
          break;
      }
    };
    const handleConfigEvent = (event: Event) => {
      handleConfig((event as CustomEvent).detail);
    };
    window.addEventListener("message", handleMessage);
    window.addEventListener("multimeter.config", handleConfigEvent);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("multimeter.config", handleConfigEvent);
    };
  }, [prepareRequestData]);

  // The initial `config` message can be delivered before this hook mounts (its
  // listeners attach one commit after the document content arrives, which loses
  // the race on slower webview startups). Adopt the cached value and ask the
  // extension to resend the config now that the listeners above exist.
  useEffect(() => {
    const cached = readCachedBodyAutoFormat();
    setAutoFormatBodyState(prev => (prev === cached ? prev : cached));
    requestEditorConfig();
  }, []);

  // Response panel is filled only via multimeter.api.run.result from the extension.
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const message = event.data;
      if (!message || message.command !== "multimeter.api.run.result") {
        return;
      }
      if (message.uri && filePath && message.uri !== filePath) {
        return;
      }
      setIsSending(false);
      const fromSend = sendPendingRef.current;
      sendPendingRef.current = false;
      if (message.cancelled) {
        return;
      }
      if (message.apiTest && Array.isArray(message.apiTest.items)) {
        setApiTestResults(message.apiTest.items);
      } else {
        setApiTestResults(null);
      }
      if (typeof message.response !== "undefined" && message.response !== null) {
        let response = message.response as Response;
        // Keep the body raw here; Response BodyView beautifies on display when
        // auto-format is on so the user can toggle format after the send.
        if (typeof response.duration === "number" && Number.isFinite(response.duration)) {
          response = { ...response, duration: Math.round(response.duration) };
        }
        setResponseData(response);
        setResponseRevision(prev => prev + 1);

        if (fromSend) {
          const req = requestDataRef.current;
          const methodRaw = resolveApiHttpMethod(
            req?.method || apiRef.current?.method,
            req?.body ?? apiRef.current?.body);
          const method = typeof methodRaw === "string" ? methodRaw.trim().toLowerCase() : "get";
          const url = req?.url ?? "";
          const protocol = protocolResolver.getEffectiveProtocol(
            req?.protocol as any, req?.url) || "http";
          const status = typeof response.status === "number" ? response.status : -1;
          const statusText = String(response.errorMessage || response.statusText || "").trim();
          const body = toContentString(response.body);
          pushHistory({
            type: status < 0 ? "error" : "recv",
            method: method.toUpperCase(),
            protocol,
            title: url,
            cookies: response.cookies,
            headers: response.headers,
            content: body || statusText,
            duration: response.duration,
            status,
            statusText: statusText || undefined,
          });
        }
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [filePath]);

  return {
    requestData,
    touchedFields,
    responseData,
    responseRevision,
    selectedExampleIdx,
    setSelectedExampleIdx,
    currentInputs,
    setCurrentInputs,
    envValues,
    autoFormatBody,
    setAutoFormatBody,
    outputs,
    setenvValues,
    apiTestResults,
    isSending,
    updateField,
    updateFields,
    restoreField,
    handleUrlChange,
    handleQueryChange,
    handleAddOutputVariable,
    prepareRequestData,
    handleSend,
    handleRunInCore,
    handleCancel,
    handleConnect,
    network,
    examples,
    resetTouchedFields
  };
}

function cloneInputs(source?: JSONRecord): JSONRecord {
  if (!source) {
    return {};
  }
  try {
    return JSON.parse(JSON.stringify(source));
  } catch {
    return { ...source };
  }
}

function toContentString(data: any): string {
  return responseBodyToRawString(data);
}

async function applyResolvedSetenvVariables(
  api: APIData,
  resolved: Array<{ name: string; value: string | number | boolean }>,
) {
  if (resolved.length === 0) {
    return;
  }

  const label = api.title ? `api - ${api.title}` : "api";
  setEnvironmentVariables(resolved.map(item => ({
    name: item.name,
    value: item.value,
    label,
    source: 'runtime' as const,
  })));
}

