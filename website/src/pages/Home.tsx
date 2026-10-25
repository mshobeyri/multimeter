import { useEffect } from 'react'
import Seo from '../components/Seo'
import Hero from '../sections/Hero'
import Features from '../sections/Features'
import GitNative from '../sections/GitNative'
import AITestGen from '../sections/AITestGen'
import WhyAiIntegrity from '../sections/WhyAiIntegrity'
import MockAndDocs from '../sections/MockAndDocs'
import FasterThanPostman from '../sections/FasterThanPostman'
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
        description="Requests, tests, mocks, and docs are YAML in Git — same files in the VS Code editor and in CI. Apache 2.0. No account."
        path="/"
      />
      <Hero />
      <div className="relative bg-surface [&>section]:py-24 lg:[&>section]:py-28">
        <Features />
        <AITestGen />
        <WhyAiIntegrity />
        <GitNative />
        <MockAndDocs />
        <FasterThanPostman />
        <Comparison />
        <FAQ />
        <CTA />
      </div>
    </>
  )
}
