import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { APIData } from "mmt-core/APIData";
import { Request, Response } from "mmt-core/NetworkData";
import { JSONRecord } from "mmt-core/CommonData";
import { safeList } from "mmt-core/safer";
import { replaceAllRefs } from "mmt-core/variableReplacer";
import { stripOmitFromRequest, isOmitSentinel } from "mmt-core/omitKeyword";
import { formatBody } from "mmt-core/markupConvertor";
import { applyAuthToRequest } from "mmt-core/apiParsePack";
import { loadEnvVariables } from "../workspaceStorage";
import { extractOutputs, extractPathAtPosition, buildBodyExprFromPath } from "mmt-core/outputExtractor";
import { setEnvironmentVariable, getEnvironmentVariable } from "../environment/environmentUtils";
import { useNetwork } from "../components/network/Network";
import { NetworkNodeApi, Error as NetworkError } from "../components/network/NetworkNodeApi";
import { pushHistory, showVSCodeMessage } from "../vsAPI";
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

      const examplesChanged =
        JSON.stringify(prevApi.examples) !== JSON.stringify(api.examples);
      const inputsChanged =
        JSON.stringify(prevApi.inputs) !== JSON.stringify(api.inputs);

      if (examplesChanged || inputsChanged) {
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
    if (
      (!api.outputs || Object.keys(api.outputs).length === 0) ||
      (( !responseData?.body || responseData.body === "" ) &&
        (!responseData?.headers || Object.keys(responseData.headers).length === 0) &&
        (!responseData?.cookies || Object.keys(responseData.cookies).length === 0))
    ) {
      return;
    }

    const extractRules = api.outputs || {};
    const outputNames = Object.keys(extractRules);

    const extractedValues = extractOutputs({
      type: "auto",
      body: responseData?.body,
      headers: responseData?.headers || {},
      cookies: responseData?.cookies || {}
    }, extractRules);

    const finalOutputs: JSONRecord = {};
    outputNames.forEach(outputName => {
      if (outputName in extractedValues) {
        finalOutputs[outputName] = extractedValues[outputName];
      } else {
        finalOutputs[outputName] = "";
      }
    });

    setOutputs(finalOutputs);
    void handleSetEnvVariables(api, finalOutputs);
  }, [responseData?.body, responseData?.headers, responseData?.cookies, api.outputs, api.setenv, api]);

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

  const handleSend = useCallback(async () => {
    const res = await network.send(requestData);
    setResponseData(res);
    setResponseRevision(prev => prev + 1);
  }, [network, requestData]);

  const handleCancel = useCallback(async () => {
    setResponseData(undefined);
    await network.cancel();
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
      if (!message) return;
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

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const message = event.data;
      if (!message || message.command !== "multimeter.api.run") {
        return;
      }
      if (message.uri && filePath && message.uri !== filePath) {
        return;
      }
      void handleSend();
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [handleSend, filePath]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const message = event.data;
      if (!message || message.command !== "multimeter.api.run.result") {
        return;
      }
      if (message.uri && filePath && message.uri !== filePath) {
        return;
      }
      if (typeof message.response !== "undefined") {
        setResponseData(message.response);
        setResponseRevision(prev => prev + 1);
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
    autoFormatBody,
    setAutoFormatBody,
    outputs,
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

type RunApiDocumentOptions = {
  api: APIData;
  inputs?: JSONRecord;
  filePath?: string;
};

export async function runApiDocument({ api, inputs, filePath }: RunApiDocumentOptions): Promise<Response | undefined> {
  const request = await buildRequestFromApi(api, inputs);
  const protocol = protocolResolver.getEffectiveProtocol(request.protocol as any, request.url);

  if (protocol !== "http") {
    showVSCodeMessage("warn", "Run from editor currently supports HTTP APIs only.");
    return undefined;
  }

  if (!request.url) {
    showVSCodeMessage("error", "API request URL is missing.");
    return undefined;
  }

  return new Promise<Response | undefined>((resolve) => {
    const method = (request.method || "get").toLowerCase();
    const url = request.url ?? "";

    pushHistory({
      type: "send",
      method,
      protocol,
      title: `${method} ${url}`,
      cookies: request.cookies,
      headers: request.headers,
      query: request.query,
      content: method === "get" ? "" : toContentString(request.body),
    });

    NetworkNodeApi.sendHttp({
      url,
      method,
      headers: request.headers || {},
      body: request.body,
      cookies: request.cookies || {},
      query: request.query || {},
      onResponse: async (res: any) => {
        if (res?.autoformat) {
          res.body = beautifyWithContentType(res.headers?.["Content-Type"], res.body);
        }

        const response: Response = {
          body: res?.body,
          headers: res?.headers || {},
          cookies: parseSetCookie(res?.headers?.["set-cookie"]),
          errorMessage: "",
          status: res?.status || -1,
          errorCode: "",
          duration: res?.duration || -1,
          warning: res?.warning,
        };

        pushHistory({
          type: "recv",
          method,
          protocol,
          title: `${method} ${url}`,
          cookies: response.cookies,
          headers: response.headers,
          content: toContentString(response.body),
          duration: response.duration,
          status: response.status,
        });

        await handleApiOutputs(api, response);

        window.postMessage({
          command: "multimeter.api.run.result",
          uri: filePath,
          response,
        }, "*");

        resolve(response);
      },
      onError: (error: NetworkError) => {
        pushHistory({
          type: "error",
          method,
          protocol,
          title: `${method} ${url} Error`,
          cookies: {},
          headers: {},
          content: toContentString(error),
          duration: error?.duration || -1,
          status: error?.status || 500,
        });

        const failure: Response = {
          body: error.body || null,
          headers: error.headers || {},
          cookies: {},
          errorMessage: error.message ?? "",
          status: error.status || 500,
          errorCode: error.code || "UNKNOWN_ERROR",
          duration: error.duration || -1,
          warning: error.warning || undefined,
        };

        window.postMessage({
          command: "multimeter.api.run.result",
          uri: filePath,
          response: failure,
        }, "*");

        resolve(failure);
      },
    });
  });
}

async function handleApiOutputs(api: APIData, response: Response) {
  if (!api.outputs || Object.keys(api.outputs).length === 0) {
    return;
  }

  const extractRules = api.outputs || {};
  const outputNames = Object.keys(extractRules);

  const extractedValues = extractOutputs({
    type: "auto",
    body: response.body,
    headers: response.headers || {},
    cookies: response.cookies || {},
  }, extractRules);

  const finalOutputs: JSONRecord = {};
  outputNames.forEach(outputName => {
    if (outputName in extractedValues) {
      finalOutputs[outputName] = extractedValues[outputName];
    } else {
      finalOutputs[outputName] = "";
    }
  });

  await handleSetEnvVariables(api, finalOutputs);
}

async function buildRequestFromApi(api: APIData, inputs?: JSONRecord): Promise<Request> {
  const resolvedInputs = inputs ?? (api.inputs || {});
  const envParameters = await getEnvironmentParameters();

  const request = replaceAllRefs(
    api,
    api?.inputs ?? {},
    resolvedInputs,
    envParameters
  ) as Request;
  const strippedRequest = stripOmitFromRequest(request) as Request;

  if (strippedRequest.body && typeof strippedRequest.body !== "string") {
    strippedRequest.body = formatBody(
      strippedRequest.format || "json",
      strippedRequest.body ?? ""
    );
  }

  return strippedRequest;
}

async function getEnvironmentParameters(): Promise<JSONRecord> {
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
}

function parseSetCookie(setCookie: string[] | string | undefined): Record<string, string> {
  if (!setCookie) return {};
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  const cookies: Record<string, string> = {};
  arr.forEach(cookieStr => {
    const [cookiePair] = cookieStr.split(";");
    const [key, value] = cookiePair.split("=");
    if (key && value) cookies[key.trim()] = value.trim();
  });
  return cookies;
}

function toContentString(data: any): string {
  if (data === null || data === undefined) return "";
  if (typeof data === "string") return data;
  if (typeof data === "object") return JSON.stringify(data, null, 2);
  return String(data);
}

// buildBodyExprFromPath is now imported from mmt-core/outputExtractor

async function handleSetEnvVariables(
  api: APIData,
  finalOutputs: JSONRecord
) {
  if (!api.setenv || typeof api.setenv !== "object" || Object.keys(api.setenv).length === 0) {
    return;
  }
  await Promise.all(
    Object.entries(api.setenv).map(async ([envKey, outputKey]) => {
      if (envKey && outputKey) {
        let value = "";
        let label = api.title ? `api - ${api.title}` : 'api';

        if (Object.prototype.hasOwnProperty.call(finalOutputs, String(outputKey))) {
          const outputValue = finalOutputs[String(outputKey)];
          if (outputValue !== "" && outputValue != null && !isOmitSentinel(outputValue)) {
            value = String(outputValue);
          }
        } else {
          value = String(outputKey);
          label = api.title ? `api - ${api.title}` : 'api';
        }

        const currentValue = await getEnvironmentVariable(envKey);
        if (currentValue !== value) {
          setEnvironmentVariable(envKey, value, label);
        }
      }
    })
  );
}

