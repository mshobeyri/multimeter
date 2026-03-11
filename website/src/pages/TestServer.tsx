import FadeIn from '../components/FadeIn'
import { ExternalLink } from 'lucide-react'

const BASE_URL = 'https://test.mmt.dev'

interface Endpoint {
  method: string
  path: string
  description: string
  example?: string
}

const endpoints: Endpoint[] = [
  { method: 'GET', path: '/', description: 'Help page listing all endpoints' },
  { method: 'ANY', path: '/echo', description: 'Echo back request details (method, headers, body, query)' },
  { method: 'ANY', path: '/anything', description: 'Alias for /echo' },
  { method: 'GET', path: '/status/200', description: 'Respond with the given HTTP status code (100–599)', example: '/status/200' },
  { method: 'ANY', path: '/delay/1000', description: 'Delay response up to 10,000 ms', example: '/delay/1000' },
  { method: 'GET', path: '/headers', description: 'Return request headers as JSON' },
  { method: 'GET', path: '/ip', description: 'Return client IP address' },
  { method: 'ANY', path: '/method/GET', description: '200 if request method matches, 405 otherwise', example: '/method/GET' },
  { method: 'GET', path: '/redirect/3', description: 'Redirect n times (max 20), then 200', example: '/redirect/3' },
  { method: 'GET', path: '/json', description: 'Sample JSON response' },
  { method: 'GET', path: '/xml', description: 'Sample XML response' },
  { method: 'GET', path: '/html', description: 'Sample HTML response' },
  { method: 'GET', path: '/bytes/1024', description: 'Random bytes (max 100 KB)', example: '/bytes/1024' },
  { method: 'GET', path: '/auth/basic', description: 'Basic auth check (user: user, pass: pass)' },
  { method: 'GET', path: '/auth/bearer', description: 'Bearer token check (token: testtoken)' },
  { method: 'GET', path: '/cookies', description: 'Return cookies sent with the request' },
  { method: 'GET', path: '/cookies/set?theme=dark', description: 'Set cookies via query params', example: '/cookies/set?theme=dark' },
  { method: 'GET', path: '/cache/3600', description: 'Set Cache-Control max-age (max 86,400)', example: '/cache/3600' },
]

function methodColor(method: string): string {
  switch (method) {
    case 'GET': return 'text-emerald-400'
    case 'POST': return 'text-blue-400'
    case 'PUT': return 'text-amber-400'
    case 'DELETE': return 'text-red-400'
    default: return 'text-slate-400'
  }
}

export default function TestServer() {
  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-white mb-3">Test Server</h1>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              A public HTTP test server at{' '}
              <a
                href={BASE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                test.mmt.dev
              </a>{' '}
              — useful for trying out Multimeter or testing any HTTP client.
              Full CORS support on all endpoints.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-16">Method</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Endpoint</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Description</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((ep, i) => {
                  const href = `${BASE_URL}${ep.example ?? ep.path}`
                  return (
                    <tr
                      key={i}
                      className="border-b border-border/50 hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <span className={`font-mono text-xs font-medium ${methodColor(ep.method)}`}>
                          {ep.method}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-white hover:text-accent transition-colors inline-flex items-center gap-1.5"
                        >
                          {ep.path}
                          <ExternalLink size={11} className="opacity-40" />
                        </a>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400 hidden sm:table-cell">
                        {ep.description}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="text-center text-xs text-slate-500 mt-8">
            Powered by Cloudflare Workers · source at{' '}
            <a
              href="https://github.com/mshobeyri/multimeter/blob/main/website/worker/testserver.ts"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-400 underline"
            >
              testserver.ts
            </a>
          </p>
        </FadeIn>
      </div>
    </div>
  )
}
