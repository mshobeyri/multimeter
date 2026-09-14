import { useEffect } from 'react'
import Seo from '../components/Seo'
import Hero from '../sections/Hero'
import Features from '../sections/Features'
import BuiltForVSCode from '../sections/BuiltForVSCode'
import GitNative from '../sections/GitNative'
import MockServer from '../sections/MockServer'
import AITestGen from '../sections/AITestGen'
import CICDReady from '../sections/CICDReady'
import Documentation from '../sections/Documentation'
import Comparison from '../sections/Comparison'
import FAQ from '../components/FAQ'
import CTA from '../sections/CTA'

export default function Home() {
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
  }, [])

  return (
    <>
      <Seo
        title="Multimeter — Git-native REST client and API tests in VS Code"
        description="Requests, tests, mocks, and docs are YAML in Git — same files in VS Code and in CI. Apache 2.0. No account."
        path="/"
      />
      <Hero />
      <div className="relative bg-surface">
        <Features />
        <BuiltForVSCode />
        <GitNative />
        <AITestGen />
        <MockServer />
        <CICDReady />
        <Documentation />
        <Comparison />
        <FAQ />
        <CTA />
      </div>
    </>
  )
}
