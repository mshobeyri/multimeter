import { Link } from 'react-router-dom'
import { ArrowRight, Check, Layers, FileCode2, GitBranch, Zap, Braces, Shrink, ShieldCheck, Puzzle } from 'lucide-react'
import Seo from '../components/Seo'
import FadeIn from '../components/FadeIn'

const marketplace =
  'https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter'

const openMeteoSample =
  'https://github.com/mshobeyri/multimeter/tree/dev/examples/real-projects/open-meteo-mmt'

const reasons = [
  {
    icon: Layers,
    title: 'Separated files — the AI chooses what to read',
    vs: 'Postman',
    body:
      'Collections push agents toward one big JSON blob. Multimeter splits work into api/, test/<area>/, suite.mmt, and env. An agent can open one area folder instead of the whole project.',
    proof:
      'Open-Meteo sample: ~42 KB across ~98 small files vs ~91 KB in one Postman collection — change locality is one or two files.',
  },
  {
    icon: Puzzle,
    title: 'API files as a proxy — one context for many tests',
    vs: 'Bruno & Postman',
    body:
      'Similar cases often repeat method, URL, headers, and bodies. In Multimeter the API file owns the request. Tests only pass inputs and check outputs — ten scenarios share one contract.',
    proof:
      'Agents reason about a small inputs/outputs card, not duplicated payloads in every file.',
  },
  {
    icon: GitBranch,
    title: 'Suites instead of collections — order is editable data',
    vs: 'Collections',
    body:
      'Run order in collections is often implicit or UI-driven. A Multimeter suite is an explicit YAML list. Parallel by default; then separates sequential stages. Reordering is a list edit an agent can patch safely.',
    proof: 'Orchestration stays declarative — same format as the tests themselves.',
  },
  {
    icon: Zap,
    title: 'Parallel runs without a JS harness',
    vs: 'Pure JS, Postman, Bruno',
    body:
      'Getting parallelism from a coding framework means maintaining a codebase. Newman and Bruno runners stay largely sequential. Multimeter parallelizes suite groups and test stages in YAML, with same-run call cache for login and setup.',
    proof:
      'Open-Meteo sample: ~0.8–1.0 s (testlight) vs ~4.3–5.7 s (Newman) for the same live calls.',
  },
  {
    icon: FileCode2,
    title: 'Declarative flows — less code in the context window',
    vs: 'pm.test & scripts',
    body:
      'Postman’s power path is scripts. Bruno leans on JS for anything non-trivial. That code is verbose and easy to hallucinate. Multimeter flows are steps: call, expect, assert, check — compact operators, not mini-programs.',
    proof: 'Less invented API surface; validate treats YAML as structured data.',
  },
  {
    icon: Braces,
    title: 'JSON and XML as YAML — denser context',
    vs: 'Escaped blobs',
    body:
      'Bodies and expects live as YAML structure instead of escaped JSON inside JSON or XML inside scripts. Nesting stays readable; diffs stay line-oriented; tokens (e:, i:, r:, c:) stay short.',
    proof: 'Fewer characters for the same tree — a format models already handle well.',
  },
]

const extras = [
  {
    icon: Shrink,
    title: 'Machine context beats dumping the file',
    body:
      'MCP and testlight expose API cards and scaffold_test so agents start from a compact contract, not a full OpenAPI dump or blank-page YAML.',
  },
  {
    icon: ShieldCheck,
    title: 'Validate is the integrity check',
    body:
      'After every generate or modify: validate → format. Wrong YAML gets compiler-like errors. The agent stops when valid — not when the prose looks right.',
  },
  {
    icon: Layers,
    title: 'Same files for human, AI, and CI',
    body:
      'What VS Code edits is what MCP scaffolds and what testlight runs. No cloud collection vs local export vs AI-generated script — one Git-native truth.',
  },
]

export default function WhyAi() {
  return (
    <>
      <Seo
        title="Why Multimeter is better with AI — low-context API testing"
        description="How Multimeter keeps AI agents accurate: separated files, API proxies, declarative suites, parallel runs, and validate loops — vs Postman and Bruno."
        path="/why-ai"
      />
      <div className="pt-28 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <p className="text-purple-400 text-sm font-semibold uppercase tracking-wider mb-3">
              AI integrity
            </p>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 leading-tight">
              Why Multimeter is better with{' '}
              <span className="gradient-text">AI</span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed mb-6">
              AI integrity here is practical: an agent can create, change, and run API tests without
              drowning in context, inventing scripts, or rewriting a giant blob. The{' '}
              <span className="text-slate-200">.mmt</span> format keeps the model honest — small
              surfaces, clear contracts, and a validate loop.
            </p>
            <p className="text-lg text-slate-400 leading-relaxed mb-12">
              Most API tools were designed for humans clicking Send. Multimeter’s files were shaped
              so humans and agents share the same Git-native YAML — and so agents only load what
              they need.
            </p>
          </FadeIn>

          <FadeIn delay={60}>
            <div className="rounded-2xl border border-purple-400/30 bg-purple-400/5 px-6 py-5 mb-14">
              <p className="text-white font-semibold mb-2">One-line thesis</p>
              <p className="text-slate-300 leading-relaxed">
                Postman and Bruno optimize for interactive request collections. Multimeter
                optimizes for composable, Git-native contracts — so AI loads less, reuses more,
                edits surgically, runs in parallel, and proves correctness with validate.
              </p>
            </div>
          </FadeIn>

          <div className="space-y-12 mb-16">
            {reasons.map((reason, index) => {
              const Icon = reason.icon
              return (
                <FadeIn key={reason.title} delay={40 + index * 20}>
                  <article>
                    <div className="flex items-start gap-4 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-400/10 text-purple-400 flex items-center justify-center shrink-0">
                        <Icon size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          {index + 1}. vs {reason.vs}
                        </p>
                        <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                          {reason.title}
                        </h2>
                      </div>
                    </div>
                    <p className="text-slate-400 leading-relaxed mb-3 pl-14">{reason.body}</p>
                    <p className="text-sm text-slate-300 pl-14 flex items-start gap-2">
                      <Check size={16} className="text-green-400 mt-0.5 shrink-0" />
                      <span>{reason.proof}</span>
                    </p>
                  </article>
                </FadeIn>
              )
            })}
          </div>

          <FadeIn>
            <h2 className="text-2xl font-bold text-white mb-6">What else keeps agents honest</h2>
            <ul className="space-y-5 mb-14">
              {extras.map((item) => {
                const Icon = item.icon
                return (
                  <li
                    key={item.title}
                    className="flex items-start gap-4 border border-border rounded-xl px-5 py-4 bg-surface-light/30"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary-light flex items-center justify-center shrink-0">
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">{item.body}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </FadeIn>

          <FadeIn>
            <h2 className="text-2xl font-bold text-white mb-4">Measured on a real sample</h2>
            <p className="text-slate-400 leading-relaxed mb-6">
              Same live Open-Meteo HTTP coverage (~61 calls). Multimeter runs in parallel with field
              expects; the Postman mirror is sequential status-200 checks.
            </p>
            <div className="overflow-x-auto rounded-xl border border-border mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface border-b border-border">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Metric</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Postman (Newman)</th>
                    <th className="text-left px-4 py-3 text-primary-light font-medium">Multimeter</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-surface-light/30">
                    <td className="px-4 py-3 text-slate-300">Wall clock</td>
                    <td className="px-4 py-3 text-slate-400">~4.3–5.7 s</td>
                    <td className="px-4 py-3 text-white">~0.8–1.0 s</td>
                  </tr>
                  <tr className="bg-surface/50">
                    <td className="px-4 py-3 text-slate-300">On disk / AI context</td>
                    <td className="px-4 py-3 text-slate-400">~91 KB (1 JSON)</td>
                    <td className="px-4 py-3 text-white">~42 KB (~98 files)</td>
                  </tr>
                  <tr className="bg-surface-light/30">
                    <td className="px-4 py-3 text-slate-300">Assertions</td>
                    <td className="px-4 py-3 text-slate-400">61 status-200</td>
                    <td className="px-4 py-3 text-white">~340 field expects</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mb-14">
              <a
                href={openMeteoSample}
                className="text-primary-light hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Browse the Open-Meteo sample project
              </a>
              {' · '}
              <Link to="/compare/postman" className="text-primary-light hover:underline">
                Full Postman comparison
              </Link>
            </p>
          </FadeIn>

          <FadeIn>
            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <a
                href={marketplace}
                className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-semibold"
                target="_blank"
                rel="noopener noreferrer"
              >
                Install in VS Code
                <ArrowRight size={16} />
              </a>
              <Link
                to="/docs/features/mcp"
                className="inline-flex items-center justify-center gap-2 border border-border hover:border-slate-500 text-white px-6 py-3 rounded-xl font-semibold"
              >
                MCP docs
              </Link>
            </div>
            <p className="text-sm text-slate-500">
              Also see{' '}
              <Link to="/compare/bruno" className="text-primary-light hover:underline">
                vs Bruno
              </Link>
              {' · '}
              <Link to="/compare/promptfoo" className="text-primary-light hover:underline">
                vs Promptfoo
              </Link>
              {' · '}
              <a href="/for-agents.html" className="text-primary-light hover:underline">
                For AI agents
              </a>
            </p>
          </FadeIn>
        </div>
      </div>
    </>
  )
}
