import { useEffect, useRef, useState } from 'react'
import FadeIn from '../components/FadeIn'
import { Server } from 'lucide-react'

const MOCK_YAML = `type: server
title: User Service Mock
port: 8080
endpoints:
  - method: get
    path: /users/:id
    status: 200
    format: json
    body:
      id: :id
      name: "Mehrdad Shobeiri"
      email: "mehrdad@mmt.dev"`

function MockYamlBlock() {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [visibleLines, setVisibleLines] = useState(0)

  const lines = MOCK_YAML.split('\n')

  useEffect(() => {
    const el = ref.current
    if (!el) { return }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => { observer.disconnect() }
  }, [])

  useEffect(() => {
    if (!inView) { return }
    const timeout = setTimeout(() => {
      const id = setInterval(() => {
        setVisibleLines((c) => {
          if (c >= lines.length) {
            clearInterval(id)
            return c
          }
          return c + 1
        })
      }, 80)
      return () => { clearInterval(id) }
    }, 400)
    return () => { clearTimeout(timeout) }
  }, [inView, lines.length])

  const colorize = (line: string) => {
    // YAML key coloring
    if (line.match(/^\s*-\s/)) {
      const parts = line.split(/^(\s*-\s)(.*)$/)
      return <><span className="text-slate-500">{parts[1]}</span><span className="text-slate-300">{parts[2]}</span></>
    }
    if (line.includes(':')) {
      const idx = line.indexOf(':')
      const key = line.slice(0, idx)
      const val = line.slice(idx)
      if (val.includes('{{')) {
        const pre = val.slice(0, val.indexOf('{{'))
        const tmpl = val.slice(val.indexOf('{{'), val.indexOf('}}') + 2)
        const post = val.slice(val.indexOf('}}') + 2)
        return <><span className="text-cyan-400">{key}</span><span className="text-slate-500">{pre}</span><span className="text-amber-400">{tmpl}</span><span className="text-slate-500">{post}</span></>
      }
      return <><span className="text-cyan-400">{key}</span><span className="text-green-400">{val}</span></>
    }
    return <span className="text-slate-300">{line}</span>
  }

  return (
    <div ref={ref} className="bg-surface-light border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-surface border-b border-border">
        <div className="w-3 h-3 rounded-full bg-red-500/70" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <div className="w-3 h-3 rounded-full bg-green-500/70" />
        <span className="ml-2 text-xs text-slate-500">user-service.mmt</span>
      </div>
      <div className="p-6 font-mono text-sm leading-relaxed min-h-[340px] whitespace-pre">
        {lines.slice(0, visibleLines).map((line, i) => (
          <div key={i}>
            {line === '' ? <br /> : colorize(line)}
          </div>
        ))}
        {visibleLines < lines.length && (
          <span className="inline-block w-[2px] h-[1.1em] bg-accent align-middle animate-pulse" />
        )}
      </div>
    </div>
  )
}

export default function MockServer() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text — left */}
          <FadeIn direction="left">
            <div>
              <span className="text-pink-400 text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Server size={16} />
                Mock Server
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-6">
                Spin up mock APIs{' '}
                <span className="gradient-text">instantly</span>
              </h2>
              <p className="text-lg text-slate-400 mb-6 leading-relaxed">
                Define HTTP and WebSocket mock servers as simple YAML files.
                They start in milliseconds and support dynamic responses,
                path parameters, request body mirroring, and reflect mode —
                all without any external tools.
              </p>
              <ul className="space-y-4">
                {[
                  'Define routes, status codes, headers, and response bodies in YAML',
                  'Dynamic responses with template variables (params, body, random, date)',
                  'Reflect mode — echo back exactly what the client sends',
                  'Start from suites with the servers: field for integration testing',
                  'Start from tests with the run step for self-contained test scenarios',
                  'HTTP and WebSocket protocols supported',
                  'History panel shows every request received by the mock server',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-pink-400 shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>

          {/* Mock YAML preview — right */}
          <FadeIn direction="right" delay={200}>
            <MockYamlBlock />
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
