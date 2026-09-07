import { useEffect } from 'react'

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.querySelector(selector) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value)
  }
}

export default function Seo({
  title,
  description,
  path = '/',
  noIndex = false,
}: {
  title: string
  description: string
  path?: string
  noIndex?: boolean
}) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title
    const url = `https://mmt.dev${path.startsWith('/') ? path : `/${path}`}`

    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    const previousDescription = meta.getAttribute('content')
    meta.setAttribute('content', description)

    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: description,
    })
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url })
    upsertMeta('meta[property="og:image"]', {
      property: 'og:image',
      content: 'https://mmt.dev/og.png',
    })
    upsertMeta('meta[property="og:image:alt"]', {
      property: 'og:image:alt',
      content: 'Multimeter — AI-powered REST Client for VS Code',
    })
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' })
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: description,
    })
    upsertMeta('meta[name="twitter:image"]', {
      name: 'twitter:image',
      content: 'https://mmt.dev/og.png',
    })
    upsertMeta('meta[name="twitter:image:alt"]', {
      name: 'twitter:image:alt',
      content: 'Multimeter — AI-powered REST Client for VS Code',
    })
    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: 'summary_large_image',
    })
    if (noIndex) {
      upsertMeta('meta[name="robots"]', { name: 'robots', content: 'noindex, follow' })
    } else {
      const robots = document.querySelector('meta[name="robots"]')
      if (robots?.getAttribute('content') === 'noindex, follow') {
        robots.remove()
      }
    }

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', url)

    return () => {
      document.title = previousTitle
      if (previousDescription !== null) {
        meta.setAttribute('content', previousDescription)
      }
    }
  }, [title, description, path, noIndex])
  return null
}
