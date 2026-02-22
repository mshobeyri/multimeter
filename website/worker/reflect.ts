/**
 * Reflect Worker for reflect.mmt.dev
 * Returns back everything it receives: method, URL, headers, query params, and body.
 * Useful for testing API calls with Multimeter.
 */

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // Parse body based on content type
    let body: unknown = null;
    const contentType = request.headers.get('content-type') || '';

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      if (contentType.includes('application/json')) {
        try {
          body = await request.json();
        } catch {
          body = await request.text();
        }
      } else if (contentType.includes('form')) {
        const formData = await request.formData();
        const entries: Record<string, string> = {};
        formData.forEach((value, key) => {
          entries[key] = value.toString();
        });
        body = entries;
      } else {
        body = await request.text();
      }
    }

    // Build query params object
    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    // Build headers object (exclude Cloudflare internal headers)
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      if (!key.startsWith('cf-') && key !== 'x-real-ip') {
        headers[key] = value;
      }
    });

    const response = {
      method: request.method,
      url: request.url,
      path: url.pathname,
      query: Object.keys(query).length > 0 ? query : undefined,
      headers,
      body: body || undefined,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(),
      },
    });
  },
};

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };
}
