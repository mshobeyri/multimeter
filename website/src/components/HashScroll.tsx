import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function HashScroll() {
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) {
      return
    }

    const id = decodeURIComponent(location.hash.slice(1))
    const scrollToTarget = () => {
      const element = document.getElementById(id)
      if (element) {
        element.scrollIntoView({ block: 'start', behavior: 'smooth' })
      }
    }

    const frame = window.requestAnimationFrame(scrollToTarget)
    const timeout = window.setTimeout(scrollToTarget, 120)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [location.pathname, location.hash])

  return null
}
