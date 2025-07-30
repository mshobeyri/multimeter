export interface ResponseData {
  body: any;
  headers: Record<string, string>;
  cookies: Record<string, string>;
}

function resolvePath(response: ResponseData, expr: string): any {
  // Supports paths like body.items[0].name or headers['x-token']
  const parts = expr.split(".");
  let val: any = response;
  for (let part of parts) {
    // Handle array index: e.g. items[0]
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      val = val[arrayMatch[1]];
      if (Array.isArray(val)) {
        val = val[parseInt(arrayMatch[2], 10)];
      } else {
        return "";
      }
    } else if (part.match(/^\w+\['(.+)'\]$/)) {
      // Handle object key with brackets: headers['x-token']
      const keyMatch = part.match(/^\w+\['(.+)'\]$/);
      if (keyMatch) {
        val = val[keyMatch[1]];
      } else {
        return "";
      }
    } else {
      val = val[part];
    }
    if (val === undefined || val === null) return "";
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
    if (expr.startsWith("regex ")) {
      const pattern = expr.slice(6);
      let value = "";
      try {
        const regex = new RegExp(pattern);
        const bodyStr = typeof response.body === "string" ? response.body : JSON.stringify(response.body);
        const found = bodyStr.match(regex);
        value = found && found[1] ? found[1] : "";
      } catch (e) {
        value = "";
      }
      result[key] = value;
    } else if (/^\w+\./.test(expr)) {
      result[key] = resolvePath(response, expr);
    } else {
      result[key] = "";
    }
  }

  return result;
}