import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { APIData } from "mmt-core/APIData";
import { Request, Response } from "mmt-core/NetworkData";
import { JSONRecord } from "mmt-core/CommonData";
import { safeList } from "mmt-core/safer";
import { replaceAllRefs } from "mmt-core/variableReplacer";
import { stripOmitFromRequest } from "mmt-core/omitKeyword";
import { formatBody } from "mmt-core/markupConvertor";
import { applyAuthToRequest } from "mmt-core/apiParsePack";
import { loadEnvVariables } from "../workspaceStorage";
import { extractOutputs, extractPathAtPosition, buildBodyExprFromPath } from "mmt-core/outputExtractor";
import { resolveSetenvValues } from "mmt-core/setenvResolve";
import { setEnvironmentVariables } from "../environment/environmentUtils";
import { useNetwork } from "../components/network/Network";
import { pushHistory } from "../vsAPI";
import { beautifyWithContentType } from "mmt-core/markupConvertor";
import { protocolResolver } from "mmt-core";
import {
  ApiUiRefreshScope,
  applyScopedRequestData,
  diffApiRefreshScopes,
  isDocOnlyRefresh,
} from "./apiUiRefresh";

type OutputPosition = { text?: string; line: number; column: number };

interface UseAPITesterLogicParams {
  api: APIData;
  onUpdateApi?: (patch: Partial<APIData>) => void;
  filePath?: string;
}

export function useAPITesterLogic({ api, onUpdateApi, filePath }: UseAPITesterLogicParams) {
  const [autoFormatBody, setAutoFormatBodyState] = useState<boolean>(() => getInitialBodyAutoFormat());
  const network = useNetwork(autoFormatBody);
  const apiRef = useRef<APIData>(api);
  const [requestData, setRequestData] = useState<Request>();
  const requestDataRef = useRef(requestData);
  requestDataRef.current = requestData;
  const [isSending, setIsSending] = useState(false);
  const sendPendingRef = useRef(false);
  const [responseData, setResponseData] = useState<Response>();
  const [responseRevision, setResponseRevision] = useState<number>(0);
  const [selectedExampleIdx, setSelectedExampleIdx] = useState<number>(-1);
  const prevApiRef = useRef<APIData | undefined>(undefined);
  const prevExampleIdxRef = useRef<number>(-1);
  const [currentInputs, setCurrentInputs] = useState<JSONRecord>({});
  const currentInputsRef = useRef<JSONRecord>({});
  const touchedFieldsRef = useRef<Set<keyof Request>>(new Set());
  const [touchedFields, setTouchedFields] = useState<Set<keyof Request>>(new Set());
  const [outputs, setOutputs] = useState<JSONRecord>({});

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

  const updateField = useCallback((field: keyof Request, value: unknown) => {
    markFieldTouched(field);
    setRequestData(prev => ({
      ...(prev ?? {}),
      [field]: value
    } as Request));
  }, [markFieldTouched]);

  const handleUrlChange = useCallback((newUrl: string) => {
    if (newUrl !== requestData?.url) {
      markFieldTouched("url");
      setRequestData(prev => ({
        ...(prev ?? {}),
        url: newUrl
      } as Request));
    }
  }, [requestData?.url, markFieldTouched]);

  const handleQueryChange = useCallback((query: Record<string, string>) => {
    const prevQuery = JSON.stringify(requestData?.query || {});
    const nextQuery = JSON.stringify(query || {});
    if (prevQuery !== nextQuery) {
      updateField("query", query);
    }
  }, [requestData?.query, updateField]);

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

    (async () => {
      const envVars = await new Promise<any[]>(resolve => {
        const cleanup = loadEnvVariables(vars => {
          cleanup();
          resolve(vars);
        });
      });

      const envParameters: JSONRecord = safeList(envVars).reduce((acc, envVar) => {
        acc[envVar.name] = envVar.value;
        return acc;
      }, {} as JSONRecord);

      let rface = replaceAllRefs(
        api,
        api?.inputs ?? {},
        resolvedInputs,
        envParameters
      ) as Request & { auth?: any };
      rface = stripOmitFromRequest(rface) as Request & { auth?: any };

      if (rface.auth) {
        const applied = applyAuthToRequest(rface.auth, rface.headers || {}, rface.query);
        rface.headers = applied.headers;
        if (applied.query) {
          rface.query = applied.query;
        }
        delete rface.auth;
      }

      if (rface.body && typeof rface.body !== "string") {
        rface.body = formatBody(rface.format || "json", rface.body ?? "");
      }

      setRequestData((prev) =>
        applyScopedRequestData(prev, rface, scopes, touchedFieldsRef.current, respectTouched)
      );
    })();
  }, [api, resetTouchedFields]);

  // Rebuild request UI only for scopes that actually changed (url / body / headers / …).
  useEffect(() => {
    const prevApi = prevApiRef.current;
    const exampleChanged = prevExampleIdxRef.current !== selectedExampleIdx;
    prevExampleIdxRef.current = selectedExampleIdx;

    let scopes: ApiUiRefreshScope[];
    let forceReset = false;
    let exampleIdx = selectedExampleIdx;

    if (!prevApi) {
      scopes = ["all"];
      forceReset = true;
    } else if (prevApi !== api) {
      scopes = diffApiRefreshScopes(prevApi, api);
      if (scopes.length === 0 && !exampleChanged) {
        prevApiRef.current = api;
        return;
      }

      const inputsChanged =
        JSON.stringify(prevApi.inputs) !== JSON.stringify(api.inputs);

      // Examples-only edits do not affect request values — skip rebuild via isDocOnlyRefresh.
      if (inputsChanged) {
        forceReset = true;
        scopes = ["all"];
        exampleIdx = -1;
        if (selectedExampleIdx !== -1) {
          prevExampleIdxRef.current = -1;
          setSelectedExampleIdx(-1);
        }
      } else if (scopes.includes("all")) {
        forceReset = true;
      }
    } else if (exampleChanged) {
      scopes = ["all"];
      forceReset = true;
    } else {
      prevApiRef.current = api;
      return;
    }

    prevApiRef.current = api;

    if (isDocOnlyRefresh(scopes)) {
      return;
    }

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
    }

    void handleSetEnvVariables(api, extractSource, finalOutputs);
  }, [responseData?.body, responseData?.headers, responseData?.cookies, responseData?.status, responseData?.duration, api.outputs, api.setenv, api]);

  const handleAddOutputVariable = useCallback((pos: OutputPosition) => {
    const bodyText = pos.text ?? "";

    const fmt = (requestData?.format || "json").toLowerCase();
    const contentType: "json" | "xml" =
      fmt.includes("xml") || bodyText.trim().startsWith("<")
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
  }, [onUpdateApi, requestData?.format]);

  // HTTP/GraphQL/gRPC Send: one core round-trip via runCurrentDocument.
  // The extension posts multimeter.api.run.result so the Response panel and
  // finish log share the same network duration. WS still uses the live socket.
  const runViaCore = useCallback((opts: { forSend: boolean }) => {
    if (opts.forSend) {
      setIsSending(true);
      sendPendingRef.current = true;
      const protocol = protocolResolver.getEffectiveProtocol(
        requestData?.protocol as any, requestData?.url) || "http";
      const method = (requestData?.method || "get").toLowerCase();
      const url = requestData?.url ?? "";
      pushHistory({
        type: "send",
        method: method.toUpperCase(),
        protocol,
        title: url,
        cookies: requestData?.cookies,
        headers: requestData?.headers,
        query: requestData?.query,
        content: method === "get" ? "" : toContentString(requestData?.body),
      });
    }
    window.vscode?.postMessage({
      command: "runCurrentDocument",
      report: { type: "lifecycle" },
      inputs: {
        exampleIndex: selectedExampleIdx,
        manualInputs: currentInputs,
      },
    });
  }, [requestData, selectedExampleIdx, currentInputs]);

  const handleSend = useCallback(async () => {
    setResponseData(undefined);
    setResponseRevision(prev => prev + 1);

    const protocol = protocolResolver.getEffectiveProtocol(
      requestData?.protocol as any, requestData?.url);

    if (protocol === "ws") {
      const res = await network.send(requestData);
      setResponseData(res);
      setResponseRevision(prev => prev + 1);
      return;
    }

    runViaCore({ forSend: true });
  }, [network, requestData, runViaCore]);

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
  }, []);

  useEffect(() => {
    const handleConfig = (message: any) => {
      if (typeof message.bodyAutoFormat === "boolean") {
        setAutoFormatBodyState(message.bodyAutoFormat);
        prepareRequestData(undefined, { forceReset: true, scopes: ["all"] });
      }
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
      if (typeof message.response !== "undefined" && message.response !== null) {
        let response = message.response as Response;
        if (autoFormatBody && response.body != null && response.headers) {
          const contentType =
            response.headers["Content-Type"] || response.headers["content-type"] || "";
          response = {
            ...response,
            body: beautifyWithContentType(contentType, response.body),
          };
        }
        if (typeof response.duration === "number" && Number.isFinite(response.duration)) {
          response = { ...response, duration: Math.round(response.duration) };
        }
        setResponseData(response);
        setResponseRevision(prev => prev + 1);

        if (fromSend) {
          const req = requestDataRef.current;
          const method = (req?.method || "get").toLowerCase();
          const url = req?.url ?? "";
          const protocol = protocolResolver.getEffectiveProtocol(
            req?.protocol as any, req?.url) || "http";
          pushHistory({
            type: response.status != null && response.status < 0 ? "error" : "recv",
            method: method.toUpperCase(),
            protocol,
            title: url,
            cookies: response.cookies,
            headers: response.headers,
            content: toContentString(response.body ?? response.errorMessage),
            duration: response.duration,
            status: response.status,
          });
        }
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [filePath, autoFormatBody]);

  return {
    requestData,
    touchedFields,
    responseData,
    responseRevision,
    selectedExampleIdx,
    setSelectedExampleIdx,
    currentInputs,
    setCurrentInputs,
    autoFormatBody,
    setAutoFormatBody,
    outputs,
    isSending,
    updateField,
    handleUrlChange,
    handleQueryChange,
    handleAddOutputVariable,
    prepareRequestData,
    handleSend,
    handleCancel,
    handleConnect,
    network,
    examples,
    resetTouchedFields
  };
}

function getInitialBodyAutoFormat(): boolean {
  return (window as any).__mmtBodyAutoFormat === true;
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
  if (data === null || data === undefined) {
    return "";
  }
  if (typeof data === "string") {
    return data;
  }
  if (typeof data === "object") {
    return JSON.stringify(data, null, 2);
  }
  return String(data);
}

async function handleSetEnvVariables(
  api: APIData,
  response: {
    type: "auto";
    body: any;
    headers: Record<string, any>;
    cookies: Record<string, any>;
    status?: number;
    duration?: number;
  },
  finalOutputs: JSONRecord
) {
  if (!api.setenv || typeof api.setenv !== "object" || Object.keys(api.setenv).length === 0) {
    return;
  }

  const resolved = resolveSetenvValues({
    response,
    setenv: api.setenv,
    outputs: api.outputs,
    extractedOutputs: finalOutputs,
  });
  if (resolved.length === 0) {
    return;
  }

  const label = api.title ? `api - ${api.title}` : "api";
  setEnvironmentVariables(resolved.map(item => ({
    name: item.name,
    value: item.value,
    label,
  })));
}

