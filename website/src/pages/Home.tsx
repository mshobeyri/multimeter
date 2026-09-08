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
  return (
    <>
      <Seo
        title="Multimeter — AI-powered REST Client and API testing in VS Code (Postman alternative)"
        description="Multimeter is an AI-powered REST Client and API testing tool for VS Code and CI. It is not an electrical multimeter. YAML .mmt files, testlight CLI, mmt-mcp. Git-native alternative to Postman. Judge API answers with AI — also an alternative to Promptfoo."
        path="/"
      />
      <Hero />
      <div className="relative z-10 bg-surface">
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
