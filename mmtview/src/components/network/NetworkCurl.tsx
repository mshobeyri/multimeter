import { HTTPRequestOptions } from "./NetworkData";

export function buildCurlCommand(options: HTTPRequestOptions): string {
    const {
        url,
        method = "GET",
        headers = {},
        body,
        cookies,
        params,
    } = options;

    let curlCmd = [`curl -i -s -X ${method}`];

    Object.entries(headers).forEach(([k, v]) => {
        curlCmd.push(`-H "${k}: ${v}"`);
    });

    if (cookies && Object.keys(cookies).length > 0) {
        const cookieStr = Object.entries(cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");
        curlCmd.push(`-H "Cookie: ${cookieStr}"`);
    }

    if (body) {
        const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
        curlCmd.push(`--data '${bodyStr}'`);
    }

    let finalUrl = url;
    if (params && Object.keys(params).length > 0) {
        const paramStr = Object.entries(params)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join("&");
        finalUrl += (finalUrl.includes("?") ? "&" : "?") + paramStr;
    }

    curlCmd.push(`"${finalUrl}"`);
    return curlCmd.join(" ");
}

export const parseSetCookie = (setCookie: string[] | undefined): Record<string, string> => {
    if (!setCookie) return {};
    const cookies: Record<string, string> = {};
    setCookie.forEach(cookieStr => {
        const [cookiePair] = cookieStr.split(";");
        const [key, value] = cookiePair.split("=");
        if (key && value) cookies[key.trim()] = value.trim();
    });
    return cookies;
};
