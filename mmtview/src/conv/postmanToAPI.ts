import { APIData, InterfaceData } from "../api/APIData";

// Helper to extract key-value pairs from Postman format
function extractKeyValue(arr: any[] = []) {
  const obj: Record<string, string> = {};
  arr.forEach(item => {
    if (item.key && typeof item.value !== "undefined") {
      obj[item.key] = item.value;
    }
  });
  return obj;
}

export function postmanToAPI(postmanJson: any): APIData[] {
  if (!postmanJson || !postmanJson.item) {
    return [];
  }

  // Each collection becomes one APIData
  const api: APIData = {
    type: "api",
    title: postmanJson.info?.name || "",
    tags: [],
    description: postmanJson.info?.description || "",
    import: [],
    inputs: [],
    outputs: [],
    interfaces: [],
    examples: [],
  };

  // Flatten all requests (recursively for folders)
  function flattenItems(items: any[]): any[] {
    return items.flatMap(item =>
      item.item ? flattenItems(item.item) : [item]
    );
  }
  const requests = flattenItems(postmanJson.item);

  api.interfaces = requests.map((req: any) => {
    const request = req.request || {};
    const url = typeof request.url === "string"
      ? request.url
      : request.url?.raw || "";

    const headers = extractKeyValue(request.header);
    const query = extractKeyValue(request.url?.query);

    let body: string | object | undefined = undefined;
    if (request.body?.mode === "raw") {
      body = request.body.raw;
    } else if (request.body?.mode === "urlencoded") {
      body = extractKeyValue(request.body.urlencoded);
    } else if (request.body?.mode === "formdata") {
      body = extractKeyValue(request.body.formdata);
    }

    return {
      name: req.name || request.url?.raw || "",
      protocol: "http", // or infer from url
      format: "json",   // or infer from headers/body
      url,
      method: request.method?.toLowerCase() || "get",
      headers,
      query,
      body,
    } as InterfaceData;
  });

  return [api];
}