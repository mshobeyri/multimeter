import { useState, useEffect, useCallback, useMemo } from "react";
import { APIData } from "mmt-core/APIData";
import { Request, Response } from "mmt-core/NetworkData";
import { JSONRecord } from "mmt-core/CommonData";
import { safeList } from "mmt-core/safer";
import { replaceAllRefs } from "mmt-core/variableReplacer";
import { formatBody } from "mmt-core/markupConvertor";
import { loadEnvVariables } from "../workspaceStorage";
import { extractOutputs, extractPathAtPosition } from "mmt-core/outputExtractor";
import { setEnvironmentVariable, getEnvironmentVariable } from "../environment/environmentUtils";
import { useNetwork } from "../components/network/Network";

type OutputPosition = { text?: string; line: number; column: number };

interface UseAPITesterLogicParams {
  api: APIData;
  onUpdateApi?: (patch: Partial<APIData>) => void;
  filePath?: string;
}

export function useAPITesterLogic({ api, onUpdateApi, filePath }: UseAPITesterLogicParams) {
  const network = useNetwork();
  const [requestData, setRequestData] = useState<Request>();
  const [responseData, setResponseData] = useState<Response>();
  const [responseRevision, setResponseRevision] = useState<number>(0);
  const [selectedExampleIdx, setSelectedExampleIdx] = useState<number>(-1);
  const [currentInputs, setCurrentInputs] = useState<JSONRecord>({});
  const [autoFormatBody, setAutoFormatBodyState] = useState<boolean>(false);
  const [outputs, setOutputs] = useState<JSONRecord>({});

  const examples = useMemo(() => safeList(api.examples), [api.examples]);

  useEffect(() => {
    setSelectedExampleIdx(-1);
  }, [api]);

  const updateField = useCallback((field: keyof Request, value: unknown) => {
    setRequestData(prev => ({
      ...(prev ?? {}),
      [field]: value
    } as Request));
  }, []);

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

  const prepareRequestData = useCallback((inputs?: JSONRecord) => {
    const resolvedInputs = inputs ?? currentInputs;

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

      setRequestData(prevRequestData => {
        if (prevRequestData?.body !== (rface.body || "")) {
          return {
            ...prevRequestData,
            body: rface.body || ""
          } as Request;
        }
        return prevRequestData;
      });

      setRequestData(rface);
    })();
  }, [api, currentInputs]);

  useEffect(() => {
    const baseInputs = selectedExampleIdx === -1
      ? (api.inputs || {})
      : (examples[selectedExampleIdx]?.inputs || {});

    setCurrentInputs(baseInputs);
    prepareRequestData(baseInputs);
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

    const existing = { ...(api.outputs || {}) };
    let key = suggestedKey;
    let counter = 1;
    while (Object.prototype.hasOwnProperty.call(existing, key)) {
      key = `${suggestedKey}_${counter++}`;
    }

    existing[key] = expr;
    onUpdateApi?.({ outputs: existing });
    api.outputs = existing;
  }, [api, onUpdateApi, requestData?.format]);

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
          prepareRequestData();
          break;
        case "config":
          if (typeof message.bodyAutoFormat === "boolean") {
            setAutoFormatBodyState(message.bodyAutoFormat);
            prepareRequestData();
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
    examples
  };
}

function buildBodyExprFromPath(path: Array<string | number>): string {
  const parts = path.map(seg => `[${String(seg)}]`).join("");
  return `body${parts}`;
}

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
        let label = api.title ? `api(${api.title}) - ${outputKey}` : envKey;

        if (Object.prototype.hasOwnProperty.call(finalOutputs, String(outputKey))) {
          const outputValue = finalOutputs[String(outputKey)];
          if (outputValue !== "" && outputValue != null) {
            value = String(outputValue);
          }
        } else {
          value = String(outputKey);
          label = api.title ? `api(${api.title})` : envKey;
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
