import FadeIn from '../components/FadeIn'
import { FileText } from 'lucide-react'

export default function Documentation() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text — left */}
          <FadeIn direction="left">
            <div>
              <span className="text-sky-400 text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <FileText size={16} />
                API Documentation
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-6">
                Docs that write themselves
              </h2>
              <p className="text-lg text-slate-400 mb-6 leading-relaxed">
                Multimeter auto-generates polished, interactive API documentation
                straight from your <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">.mmt</code> files.
                No extra tooling, no separate doc repo — your docs live alongside
                your tests and stay in sync automatically.
              </p>
              <ul className="space-y-4">
                {[
                  'Auto-generated from the same YAML you already write',
                  'Dark and light themes with syntax-highlighted examples',
                  'Interactive request/response previews for every endpoint',
                  'Export as self-contained HTML or Markdown',
                  'Group endpoints by tags, show inputs, outputs, and examples',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <a
                  href="/demos/sample_doc.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30 hover:bg-sky-500/25 transition-colors duration-200 font-medium text-sm"
                >
                  <FileText size={16} />
                  View sample documentation
                  <span className="text-sky-500/60">↗</span>
                </a>
              </div>
            </div>
          </FadeIn>

          {/* Doc preview — right */}
          <FadeIn direction="right" delay={200}>
            <div className="glow rounded-2xl overflow-hidden border border-border">
              <div className="relative bg-surface-light">
                {/* Browser chrome header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-surface border-b border-border">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                  <span className="ml-2 text-xs text-slate-500 truncate">sample_doc.html</span>
                </div>
                {/* Embedded doc preview */}
                <a
                  href="/demos/sample_doc.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block cursor-pointer group"
                >
                  <div className="relative overflow-hidden" style={{ height: 420 }}>
                    <iframe
                      src="/demos/sample_doc.html"
                      title="Sample API documentation"
                      className="w-full pointer-events-none border-0"
                      style={{ height: 600 }}
                      loading="lazy"
                      scrolling="no"
                    />
                    {/* Bottom fade */}
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-surface-light to-transparent pointer-events-none" />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-surface/90 text-white text-sm px-4 py-2 rounded-lg border border-border">
                        Open full preview ↗
                      </span>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
