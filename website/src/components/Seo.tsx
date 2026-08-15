import { useEffect } from 'react'

export default function Seo({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    const previousDescription = meta.getAttribute('content')
    meta.setAttribute('content', description)
    return () => {
      document.title = previousTitle
      if (previousDescription !== null) {
        meta.setAttribute('content', previousDescription)
      }
    }
  }, [title, description])
  return null
}
