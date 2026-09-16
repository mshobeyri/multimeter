import { useEffect, useRef, useState } from 'react'
import FadeIn from '../components/FadeIn'
import { GitBranch } from 'lucide-react'

const COMMIT_TEXT = 'git commit -m "Add reflected message as output"'
const CHAR_SPEED = 45

function TypingBox() {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [count, setCount] = useState(0)

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
    <div ref={ref} className="bg-surface border border-[#F05032]/25 rounded-xl p-4 font-mono text-sm text-slate-300 overflow-x-auto whitespace-nowrap shadow-xl">
      <span className="text-slate-500">$ </span>
      <span>{before}</span>
      {flag && <span>{flag}</span>}
      {quoted && <span className="text-[#F05032]">{quoted}</span>}
      {showCursor && <span className="inline-block w-[2px] h-[1.1em] bg-[#F05032] align-middle animate-pulse ml-[1px]" />}
    </div>
  )
}

const BULLETS = [
  'Review tests in the same pull request as your code',
  'Check out any branch — tests match that version',
  'Share a repro as a committed file anyone can run',
]

export default function GitNative() {
  return (
    <section id="git-native" className="scroll-mt-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <FadeIn direction="up">
          <div className="text-center mb-10 max-w-3xl mx-auto">
            <span className="text-[#F05032] text-sm font-semibold uppercase tracking-wider flex items-center gap-2 justify-center">
              <GitBranch size={16} />
              Version Controlled
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4 leading-snug">
              Tests live in Git, reviewed in pull requests.
            </h2>
            <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl mx-auto">
              No cloud collections. No proprietary formats. Just{' '}
              <code className="text-orange-400 bg-[#F05032]/10 px-1.5 py-0.5 rounded text-sm">.mmt</code>{' '}
              files in your repo, versioned beside the code they protect.
            </p>
          </div>
        </FadeIn>

        <FadeIn direction="up" delay={100}>
          <div className="relative max-w-4xl mx-auto mb-10">
            <div className="rounded-2xl overflow-hidden border border-[#F05032]/20 shadow-[0_0_60px_rgba(240,80,50,0.12)]">
              <img
                src="/screenshots/git.png"
                alt="Multimeter tests versioned in Git"
                className="w-full"
              />
            </div>
            <div className="relative -mt-6 mx-4 sm:mx-8 lg:mx-12">
              <TypingBox />
            </div>
          </div>
        </FadeIn>

        <FadeIn direction="up" delay={180}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {BULLETS.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 bg-surface-light/60 border border-[#F05032]/20 rounded-xl px-4 py-4"
              >
                <span className="mt-1.5 w-2 h-2 rounded-full bg-[#F05032] shrink-0" />
                <span className="text-slate-300 text-sm sm:text-base">{item}</span>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
