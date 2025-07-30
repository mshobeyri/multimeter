export interface ResponseData {
  body: any;
  headers: Record<string, string>;
  cookies: Record<string, string>;
}

function resolvePath(response: ResponseData, expr: string): any {
  const [root, ...rest] = expr.split(".");
  let val = (response as any)[root];
  for (const p of rest) {
    if (val && typeof val === "object") {
      val = val[p];
    } else {
      return "";
    }
  }
  return val ?? "";
}

export function extractOutputs(
  response: ResponseData,
  outputsDef: Record<string, string>
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};

  for (const [key, expr] of Object.entries(outputsDef)) {
    if (typeof expr !== "string") {
      result[key] = "";
      continue;
    }
    if (expr.startsWith("regex(body,")) {
      const match = expr.match(/regex\(body,\s*["'](.+?)["']\)/);
      if (match) {
        const regex = new RegExp(match[1]);
        const bodyStr = typeof response.body === "string" ? response.body : JSON.stringify(response.body);
        const found = bodyStr.match(regex);
        result[key] = found && found[1] ? found[1] : "";
      }
    } else if (/^\w+\./.test(expr)) {
      result[key] = resolvePath(response, expr);
    } else {
      result[key] = "";
    }
  }

  return result;
}