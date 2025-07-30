export function extractOutputs(
    body: any, headers: Record<string, string>, cookies: Record<string, string>,
    outputsDef: Record<string, string>): Record<string, string|number|boolean> {
  const result: Record<string, string|number|boolean> = {};

  for (const [key, expr] of Object.entries(outputsDef)) {
    if (expr.startsWith('regex(body,')) {
      // Example: regex(body, "id=(\\d+)")
      const match = expr.match(/regex\(body,\s*["'](.+?)["']\)/);
      if (match) {
        const regex = new RegExp(match[1]);
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        const found = bodyStr.match(regex);
        result[key] = found && found[1] ? found[1] : '';
      }
    } else if (expr.startsWith('body.')) {
      // Example: body.name
      const path = expr.slice(5).split('.');
      let val = body;
      for (const p of path) {
        if (val && typeof val === 'object') {
          val = val[p];
        } else {
          val = undefined;
        }
      }
      result[key] = val ?? '';
    } else if (expr.startsWith('headers.')) {
      // Example: headers['x-token']
      const headerKey = expr.slice(8).replace(/^\['(.+)'\]$/, '$1');
      result[key] = headers[headerKey] ?? '';
    } else if (expr.startsWith('cookies.')) {
      // Example: cookies.session
      const cookieKey = expr.slice(8);
      result[key] = cookies[cookieKey] ?? '';
    } else {
      result[key] = '';
    }
  }

  return result;
}