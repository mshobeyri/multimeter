import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import Seo from '../components/Seo'
import { comparePageBySlug, comparePages } from '../data/comparePages'

const marketplace =
  'https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter'

export function CompareIndexPage() {
  return (
    <>
      <Seo
        title="Multimeter vs Postman, Bruno, Thunder Client, REST Client"
        description="Compare Multimeter with Postman, Bruno, Thunder Client, and REST Client. Git-native API testing in VS Code, with a CLI for CI."
      />
      <div className="pt-28 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            Compare Multimeter
          </h1>
          <p className="text-lg text-slate-400 mb-10">
            Git-native API testing in VS Code. Same files in CI. No cloud account.
          </p>
          <ul className="space-y-4">
            {comparePages.map((page) => (
              <li key={page.slug}>
                <Link
                  to={`/compare/${page.slug}`}
                  className="block border border-border rounded-xl px-5 py-4 hover:border-primary/50 hover:bg-surface-light/40 transition-colors"
                >
                  <span className="text-white font-semibold">Multimeter vs {page.name}</span>
                  <p className="text-sm text-slate-400 mt-1">{page.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}

export default function ComparePage() {
  const { slug } = useParams()
  const page = comparePageBySlug(slug)

  if (!page) {
    return (
      <>
        <Seo title="Compare Multimeter" description="API testing comparisons." />
        <div className="pt-28 pb-24 px-4 max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-3">Page not found</h1>
          <Link to="/compare" className="text-primary-light hover:underline">
            All comparisons
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <Seo title={page.title} description={page.description} />
      <div className="pt-28 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">
            Comparison
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-6">
            Multimeter vs {page.name}
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed mb-10">{page.intro}</p>

          <h2 className="text-2xl font-bold text-white mb-4">Why teams switch</h2>
          <ul className="space-y-3 mb-12">
            {page.switchReasons.map((reason) => (
              <li key={reason} className="flex items-start gap-3 text-slate-300">
                <Check size={18} className="text-green-400 mt-0.5 shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4">Side by side</h2>
          <div className="overflow-x-auto rounded-xl border border-border mb-12">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Feature</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">{page.name}</th>
                  <th className="text-left px-4 py-3 text-primary-light font-medium">Multimeter</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row, index) => (
                  <tr
                    key={row.feature}
                    className={index % 2 === 0 ? 'bg-surface-light/30' : 'bg-surface/50'}
                  >
                    <td className="px-4 py-3 text-slate-300">{row.feature}</td>
                    <td className="px-4 py-3 text-slate-400">{row.other}</td>
                    <td className="px-4 py-3 text-white">{row.multimeter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <a
              href={marketplace}
              className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-semibold"
            >
              Install in VS Code
              <ArrowRight size={16} />
            </a>
            <Link
              to="/docs/quick-start"
              className="inline-flex items-center justify-center gap-2 border border-border hover:border-slate-500 text-white px-6 py-3 rounded-xl font-semibold"
            >
              Get started
            </Link>
          </div>

          <p className="text-sm text-slate-500">
            Also compare:{' '}
            {comparePages
              .filter((item) => item.slug !== page.slug)
              .map((item, index, list) => (
                <span key={item.slug}>
                  <Link to={`/compare/${item.slug}`} className="text-primary-light hover:underline">
                    {item.name}
                  </Link>
                  {index < list.length - 1 ? ' · ' : ''}
                </span>
              ))}
          </p>
        </div>
      </div>
    </>
  )
}
