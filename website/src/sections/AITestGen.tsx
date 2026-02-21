import FadeIn from '../components/FadeIn'

export default function AITestGen() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <FadeIn direction="left">
            <div>
              <span className="text-purple-400 text-sm font-semibold uppercase tracking-wider">
                AI-Powered
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-6">
                Let AI write your tests
              </h2>
              <p className="text-lg text-slate-400 mb-6 leading-relaxed">
                The built-in <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">@Multimeter</code> chat
                participant in VS Code can generate complete test flows from natural language
                descriptions, OpenAPI specs, or existing API definitions. Just describe what
                you want to test.
              </p>
              <div className="space-y-4">
                <div className="bg-surface-light border border-border rounded-xl p-4">
                  <p className="text-sm text-slate-500 mb-2">You:</p>
                  <p className="text-sm text-slate-300">
                    @mmt Generate a login test that sends POST to /api/auth/login
                    with email and password, asserts status 200, and captures the JWT token
                  </p>
                </div>
                <div className="bg-surface-light border border-purple-500/30 rounded-xl p-4">
                  <p className="text-sm text-purple-400 mb-2">Multimeter Assistant:</p>
                  <pre className="text-sm text-slate-300 overflow-x-auto">
                    <code>{`type: test
name: Login Test
steps:
  - call: login-api
    inputs:
      email: <<e:TEST_EMAIL>>
      password: <<e:TEST_PASSWORD>>
    assert:
      status: 200
    set:
      token: body.token`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Visual */}
          <FadeIn direction="right" delay={200}>
            <div className="relative">
              <div className="absolute -inset-4 bg-purple-500/10 rounded-3xl blur-2xl" />
              <div className="relative glow rounded-2xl overflow-hidden border border-border">
                <img
                  src="/screenshots/test_panel_log.png"
                  alt="AI Test Generation in Multimeter"
                  className="w-full rounded-2xl"
                />
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
