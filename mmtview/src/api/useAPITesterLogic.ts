import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { APIData } from "mmt-core/APIData";
import { Request, Response } from "mmt-core/NetworkData";
import { JSONRecord } from "mmt-core/CommonData";
import { safeList } from "mmt-core/safer";
import { replaceAllRefs } from "mmt-core/variableReplacer";
import { formatBody } from "mmt-core/markupConvertor";
import { loadEnvVariables } from "../workspaceStorage";
import { extractOutputs, extractPathAtPosition, buildBodyExprFromPath } from "mmt-core/outputExtractor";
import { setEnvironmentVariable, getEnvironmentVariable } from "../environment/environmentUtils";
import { useNetwork } from "../components/network/Network";
import { NetworkNodeApi, Error as NetworkError } from "../components/network/NetworkNodeApi";
import { pushHistory, showVSCodeMessage } from "../vsAPI";
import { beautifyWithContentType } from "mmt-core/markupConvertor";
import { protocolResolver } from "mmt-core";

type OutputPosition = { text?: string; line: number; column: number };

interface UseAPITesterLogicParams {
  api: APIData;
  onUpdateApi?: (patch: Partial<APIData>) => void;
  filePath?: string;
}

export function useAPITesterLogic({ api, onUpdateApi, filePath }: UseAPITesterLogicParams) {
  const network = useNetwork();
  const apiRef = useRef<APIData>(api);
  const [requestData, setRequestData] = useState<Request>();
  const [responseData, setResponseData] = useState<Response>();
  const [responseRevision, setResponseRevision] = useState<number>(0);
  const [selectedExampleIdx, setSelectedExampleIdx] = useState<number>(-1);
  const [currentInputs, setCurrentInputs] = useState<JSONRecord>({});
  const currentInputsRef = useRef<JSONRecord>({});
  const touchedFieldsRef = useRef<Set<keyof Request>>(new Set());
  const [autoFormatBody, setAutoFormatBodyState] = useState<boolean>(false);
  const [outputs, setOutputs] = useState<JSONRecord>({});

  const examples = useMemo(() => safeList(api.examples), [api.examples]);

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  useEffect(() => {
    currentInputsRef.current = currentInputs;
  }, [currentInputs]);

  useEffect(() => {
    setSelectedExampleIdx(-1);
  }, [api]);

  const markFieldTouched = useCallback((field: keyof Request) => {
    touchedFieldsRef.current.add(field);
  }, []);

  const resetTouchedFields = useCallback(() => {
    touchedFieldsRef.current.clear();
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
      setRequestData(prev => ({
        ...(prev ?? {}),
        url: newUrl
      } as Request));
    }
  }, [requestData?.url]);

  const handleQueryChange = useCallback((query: Record<string, string>) => {
    const prevQuery = JSON.stringify(requestData?.query || {});
    const nextQuery = JSON.stringify(query || {});
    if (prevQuery !== nextQuery) {
      updateField("query", query);
    }
  }, [requestData?.query, updateField]);

  const prepareRequestData = useCallback((inputs?: JSONRecord, options?: { forceReset?: boolean; respectTouched?: boolean }) => {
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
      ) as Request;

      if (rface.body && typeof rface.body !== "string") {
        rface.body = formatBody(rface.format || "json", rface.body ?? "");
      }

      setRequestData(prev => mergeRequestData(prev, rface, touchedFieldsRef.current, respectTouched));
    })();
  }, [api, resetTouchedFields]);

  useEffect(() => {
    const baseInputs = selectedExampleIdx === -1
      ? (api.inputs || {})
      : (examples[selectedExampleIdx]?.inputs || {});

    const clonedInputs = cloneInputs(baseInputs);
    setCurrentInputs(clonedInputs);
    prepareRequestData(clonedInputs, { forceReset: true });
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

  const buildCurl = useCallback((): string => {
    const method = (requestData?.method || "GET").toUpperCase();
    const url = requestData?.url || "";
    const parts: string[] = ["curl"];
    if (method !== "GET") {
      parts.push("-X", method);
    }
    const headers = requestData?.headers || {};
    const cookies = requestData?.cookies || {};
    Object.entries(headers).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        parts.push("-H", `'${escapeSingleQuotes(`${k}: ${v}`)}'`);
      }
    });
    const cookiePairs = Object.entries(cookies)
      .filter(([_, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}=${v}`);
    if (cookiePairs.length) {
      parts.push("-H", `'Cookie: ${escapeSingleQuotes(cookiePairs.join('; '))}'`);
    }
    const bodyStr = typeof requestData?.body === "string"
      ? requestData?.body
      : requestData?.body != null
        ? JSON.stringify(requestData?.body)
        : "";
    if (method !== "GET" && bodyStr) {
      parts.push("--data", `'${escapeSingleQuotes(bodyStr)}'`);
    }
    parts.push(`'${escapeSingleQuotes(url)}'`);
    return parts.join(" ");
  }, [requestData]);

  const setAutoFormatBody = useCallback((next: boolean) => {
    setAutoFormatBodyState(next);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message) return;
      switch (message.command) {
        case "multimeter.environment.refresh":
          prepareRequestData(undefined, { forceReset: true });
          break;
        case "config":
          if (typeof message.bodyAutoFormat === "boolean") {
            setAutoFormatBodyState(message.bodyAutoFormat);
            prepareRequestData(undefined, { forceReset: true });
          }
          break;
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
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
    buildCurl,
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

function mergeRequestData(
  prev: Request | undefined,
  generated: Request,
  touchedFields: Set<keyof Request>,
  respectTouched: boolean
): Request {
  if (!respectTouched || !prev || touchedFields.size === 0) {
    return generated;
  }

  const merged = { ...generated } as Request;
  touchedFields.forEach(field => {
    if (typeof prev[field] !== "undefined") {
      merged[field] = prev[field];
    }
  });

  return merged;
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

  if (request.body && typeof request.body !== "string") {
    request.body = formatBody(request.format || "json", request.body ?? "");
  }

  return request;
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
          if (outputValue !== "" && outputValue != null) {
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

function escapeSingleQuotes(value: string): string {
  return String(value).replace(/'/g, "'\\''");
}
