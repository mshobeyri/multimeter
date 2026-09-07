import { Link, useLocation } from 'react-router-dom'
import Seo from '../components/Seo'

export default function NotFound() {
  const location = useLocation()
  return (
    <>
      <Seo
        title="Page not found — Multimeter"
        description="This page does not exist on mmt.dev."
        path={location.pathname}
        noIndex
      />
      <div className="pt-28 pb-24 px-4 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-3">Page not found</h1>
        <p className="text-slate-400 mb-6">That URL is not a Multimeter page.</p>
        <Link to="/" className="text-primary-light hover:underline">
          Home
        </Link>
        {' · '}
        <Link to="/docs/quick-start" className="text-primary-light hover:underline">
          Docs
        </Link>
      </div>
    </>
  )
}
