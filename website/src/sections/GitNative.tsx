import { useEffect, useRef, useState } from 'react'
import FadeIn from '../components/FadeIn'
import { GitBranch } from 'lucide-react'

const COMMIT_TEXT = 'git commit -m "Add title and an example to reproduce bug 1234"'
const CHAR_SPEED = 45     // ms per character

function TypingBox() {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [count, setCount] = useState(0)

  // Observe when the box scrolls into view
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

  // Start typing only after in view, with a small delay
  useEffect(() => {
    if (!inView) { return }
    const timeout = setTimeout(() => {
      const id = setInterval(() => {
        setCount((c) => {
          if (c >= COMMIT_TEXT.length) {
            clearInterval(id)
            return c
          }
          return c + 1
        })
      }, CHAR_SPEED)
      return () => { clearInterval(id) }
    }, 800)
    return () => { clearTimeout(timeout) }
  }, [inView])

  const visible = COMMIT_TEXT.slice(0, count)
  const showCursor = count < COMMIT_TEXT.length

  // Split the visible text to colour the quoted part
  const mIdx = visible.indexOf('-m ')
  let before = visible
  let flag = ''
  let quoted = ''
  if (mIdx !== -1) {
    before = visible.slice(0, mIdx)
    const afterM = visible.slice(mIdx)
    const qIdx = afterM.indexOf('"')
    if (qIdx !== -1) {
      flag = afterM.slice(0, qIdx)
      quoted = afterM.slice(qIdx)
    } else {
      flag = afterM
    }
  }

  return (
    <div ref={ref} className="bg-surface-light border border-border rounded-xl p-4 font-mono text-sm text-slate-300 overflow-x-auto whitespace-nowrap">
      <span className="text-slate-500">$ </span>
      <span>{before}</span>
      {flag && <span>{flag}</span>}
      {quoted && <span className="text-accent">{quoted}</span>}
      {showCursor && <span className="inline-block w-[2px] h-[1.1em] bg-accent align-middle animate-pulse ml-[1px]" />}
    </div>
  )
}

export default function GitNative() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Screenshot + terminal — left on desktop */}
          <FadeIn direction="left" delay={200}>
            <div className="order-2 lg:order-1 flex flex-col gap-4">
              <div className="glow rounded-2xl overflow-hidden border border-border">
                <img
                  src="/screenshots/git.png"
                  alt="Multimeter tests versioned in Git"
                  className="w-full rounded-2xl"
                />
              </div>
              <TypingBox />
            </div>
          </FadeIn>

          {/* Text — right on desktop */}
          <FadeIn direction="right" className="order-1 lg:order-2">
            <div>
              <span className="text-orange-400 text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <GitBranch size={16} />
                Version Controlled
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-6">
                Collaborate via Git
              </h2>
              <p className="text-lg text-slate-400 mb-6 leading-relaxed">
                Tests are plain YAML <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">.mmt</code> files
                stored right next to your source code. No proprietary formats,
                no cloud sync — just files in your repo, versioned and reviewed
                like everything else.
              </p>
              <ul className="space-y-4">
                {[
                  'Code and tests reviewed in the same pull request',
                  'Check out an older branch and run its tests — they always match that version',
                  'Share a reproduced bug as a committed test — anyone can pull and re-run it',
                  'No separate user management — your Git permissions are enough',
                  'Works with any VCS: Git, SVN, Mercurial — they are just files',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
