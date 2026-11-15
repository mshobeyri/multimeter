import FadeIn from '../components/FadeIn'
import Seo from '../components/Seo'

export default function Privacy() {
  return (
    <div className="pt-32 pb-24 px-4 sm:px-6 lg:px-8">
      <Seo
        title="Privacy — Multimeter"
        description="How Multimeter handles your data: local runs, optional anonymous usage telemetry, and what we never collect."
        path="/privacy"
      />
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            Privacy
          </h1>
          <p className="text-lg text-slate-400 mb-10">
            Multimeter is Git-native and local-first. Your collections are not
            uploaded to a Multimeter cloud workspace.
          </p>
        </FadeIn>

        <FadeIn>
          <section className="mb-10 space-y-4 text-slate-300 leading-relaxed">
            <h2 className="text-xl font-semibold text-white">API data and runs</h2>
            <p>
              Requests, responses, environment values, and <code className="text-slate-200">.mmt</code> file
              contents stay on your machine or in your own CI. We do not host your
              APIs or sync collections to mmt.dev.
            </p>
          </section>
        </FadeIn>

        <FadeIn>
          <section className="mb-10 space-y-4 text-slate-300 leading-relaxed">
            <h2 className="text-xl font-semibold text-white">Anonymous usage telemetry</h2>
            <p>
              The VS Code extension may send anonymous usage counts (for example
              that you opened a test file or ran an API, and whether inputs/outputs
              were used). It never sends URLs, headers, bodies, env values, or file
              contents.
            </p>
            <p>
              Telemetry respects VS Code&apos;s{' '}
              <code className="text-slate-200">telemetry.telemetryLevel</code> and
              Multimeter&apos;s{' '}
              <code className="text-slate-200">multimeter.telemetry.enabled</code>{' '}
              setting. Turn either off to stop usage events.
            </p>
            <p>
              Details:{' '}
              <a className="text-sky-400 hover:text-sky-300 underline" href="/docs/features/telemetry">
                Telemetry docs
              </a>
              .
            </p>
          </section>
        </FadeIn>

        <FadeIn>
          <section className="mb-10 space-y-4 text-slate-300 leading-relaxed">
            <h2 className="text-xl font-semibold text-white">Optional AI features</h2>
            <p>
              If you use Multimeter MCP with an AI client, or a{' '}
              <code className="text-slate-200">type: judge</code> step, data goes only
              to the tools and model providers you configure — not to a Multimeter
              collection cloud.
            </p>
          </section>
        </FadeIn>

        <FadeIn>
          <section className="space-y-4 text-slate-300 leading-relaxed">
            <h2 className="text-xl font-semibold text-white">Website</h2>
            <p>
              mmt.dev is a static marketing and docs site. Hosting may collect
              standard web logs (for example IP and user agent) according to the
              host&apos;s policies.
            </p>
          </section>
        </FadeIn>
      </div>
    </div>
  )
}
