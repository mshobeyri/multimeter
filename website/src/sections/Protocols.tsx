import FadeIn from '../components/FadeIn'
import { Network } from 'lucide-react'

const protocols = [
  {
    name: 'HTTP / REST / SOAP',
    icon: '/icons/http.svg',
    description: 'Full HTTP / REST / SOAP support with all methods, headers, auth, JSON / XML bodies, and .http file compatibility.',
  },
  {
    name: 'WebSocket',
    icon: '/icons/websocket.svg',
    description: 'Real-time WebSocket testing with connection management, message sending, and event listening.',
  },
  {
    name: 'GraphQL',
    icon: '/icons/graphql.svg',
    description: 'GraphQL support with operations, variables, and response extraction for queries and mutations.',
  },
  {
    name: 'gRPC',
    icon: '/icons/grpc.svg',
    description: 'gRPC protocol support with proto files, server reflection, and streaming modes.',
  }
]

export default function Protocols() {
  return (
    <section id="protocols" className="scroll-mt-20 py-24 px-4 sm:px-6 lg:px-8 bg-surface-light/30">
      <div className="max-w-7xl mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <span className="text-cyan-400 text-sm font-semibold uppercase tracking-wider flex items-center gap-2 justify-center">
              <Network size={16} />
              Multi-Protocol
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
              Every protocol you need
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Test REST APIs, WebSocket connections, GraphQL endpoints, gRPC services, and SOAP endpoints — all
              from the same tool. Existing .http request files can run as test flows too.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {protocols.map((protocol, index) => (
            <FadeIn key={protocol.name} delay={index * 100}>
              <div className="bg-surface border border-border rounded-2xl p-6 text-center hover:border-accent/50 transition-all duration-300 hover:-translate-y-1 h-full">
                <div className="w-16 h-16 mx-auto mb-4 bg-accent/10 rounded-xl flex items-center justify-center">
                  <img
                    src={protocol.icon}
                    alt={protocol.name}
                    className="w-8 h-8"
                  />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {protocol.name}
                </h3>
                <p className="text-sm text-slate-400">{protocol.description}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
