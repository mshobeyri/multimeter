import { useEffect, useRef, useState, type ReactNode } from 'react'

interface FadeInProps {
  children: ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  immediate?: boolean
}

function isInViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    return false
  }
  const vh = window.innerHeight || document.documentElement.clientHeight
  return rect.top < vh * 0.92 && rect.bottom > 48
}

/**
 * Animate when the block actually enters the viewport.
 * Off-screen content stays waiting. In-view content cannot stay invisible.
 */
export default function FadeIn({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  immediate = false,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(immediate)

  useEffect(() => {
    if (immediate) {
      return
    }
    const el = ref.current
    if (!el) {
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true)
      return
    }

    let revealed = false
    const reveal = () => {
      if (revealed) {
        return
      }
      revealed = true
      setInView(true)
    }

    const revealIfVisible = () => {
      if (!revealed && isInViewport(el)) {
        reveal()
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal()
          observer.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(el)

    window.addEventListener('scroll', revealIfVisible, { passive: true })
    window.addEventListener('resize', revealIfVisible)
    const frame = window.requestAnimationFrame(revealIfVisible)
    const poll = window.setInterval(revealIfVisible, 250)

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', revealIfVisible)
      window.removeEventListener('resize', revealIfVisible)
      window.cancelAnimationFrame(frame)
      window.clearInterval(poll)
    }
  }, [immediate])

  return (
    <div
      ref={ref}
      className={`mmt-reveal mmt-reveal-${direction} ${inView ? 'is-in' : 'is-waiting'} ${className}`.trim()}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
