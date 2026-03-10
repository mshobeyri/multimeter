import Hero from '../sections/Hero'
import Features from '../sections/Features'
import BuiltForVSCode from '../sections/BuiltForVSCode'
import GitNative from '../sections/GitNative'
import Protocols from '../sections/Protocols'
import MockServer from '../sections/MockServer'
import AITestGen from '../sections/AITestGen'
import CICDReady from '../sections/CICDReady'
import Reports from '../sections/Reports'
import Documentation from '../sections/Documentation'
import Comparison from '../sections/Comparison'
import FAQ from '../components/FAQ'
import CTA from '../sections/CTA'

export default function Home() {
  return (
    <>
      <Hero />
      <div className="relative z-10 bg-surface">
        <Features />
        <BuiltForVSCode />
        <GitNative />
        <Protocols />
        <AITestGen />
        <MockServer />
        <CICDReady />
        <Reports />
        <Documentation />
        <Comparison />
        <FAQ />
        <CTA />
      </div>
    </>
  )
}
