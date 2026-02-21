import { Play, ExternalLink } from 'lucide-react'
import FadeIn from '../components/FadeIn'

interface Demo {
  title: string
  description: string
  image: string
  docLink?: string
  docLabel?: string
}

const demos: Demo[] = [
  {
    title: 'API Testing',
    description:
      'Request configuration, method selection, headers, query params, body editing, and response handling with status codes and timing.',
    image: '/demos/api.gif',
    docLink:
      'https://github.com/mshobeyri/multimeter/blob/main/docs/api-mmt.md',
    docLabel: 'API Docs',
  },
  {
    title: 'Test Flow Editor',
    description:
      'Visual test flow editor with step orchestration: call APIs, assert responses, loop over data, set variables, and chain requests.',
    image: '/screenshots/test_panel_flow.png',
    docLink:
      'https://github.com/mshobeyri/multimeter/blob/main/docs/test-mmt.md',
    docLabel: 'Test Docs',
  },
  {
    title: 'Environment Variables',
    description:
      'Environment variable management with presets for dev/staging/production, dynamic value injection, and secure credential handling.',
    image: '/screenshots/environment.gif',
    docLink:
      'https://github.com/mshobeyri/multimeter/blob/main/docs/environment-mmt.md',
    docLabel: 'Env Docs',
  },
  {
    title: 'Mock Server',
    description:
      'Built-in HTTP and WebSocket mock server for simulating API endpoints during development and testing.',
    image: '/screenshots/mock_server.png',
    docLink:
      'https://github.com/mshobeyri/multimeter/blob/main/docs/mock-server.md',
    docLabel: 'Mock Docs',
  },
  {
    title: 'Test Suites',
    description:
      'Group and run multiple tests with sequential and parallel execution. Organize your test strategy with suite files.',
    image: '/screenshots/suite.png',
    docLink:
      'https://github.com/mshobeyri/multimeter/blob/main/docs/suite-mmt.md',
    docLabel: 'Suite Docs',
  },
  {
    title: 'Import & Convert',
    description:
      'Seamlessly import from Postman collections and OpenAPI specifications. Zero-friction migration to Multimeter.',
    image: '/screenshots/convertor.png',
    docLink:
      'https://github.com/mshobeyri/multimeter/blob/main/docs/convertor.md',
    docLabel: 'Convertor Docs',
  },
  {
    title: 'Test Results & Logs',
    description:
      'Detailed test execution logs showing requests, responses, assertions, timing, and pass/fail results.',
    image: '/screenshots/test_panel_log.png',
  },
  {
    title: 'Test History',
    description:
      'Full test execution history stored in your repository. Track test results over time and compare runs.',
    image: '/screenshots/history.png',
    docLink:
      'https://github.com/mshobeyri/multimeter/blob/main/docs/history.md',
    docLabel: 'History Docs',
  },
  {
    title: 'UI Editor (No-Code)',
    description:
      'Visual UI editor for creating and editing tests without writing YAML. Perfect for non-technical team members.',
    image: '/screenshots/test_panel_test.png',
  },
]

export default function Demos() {
  return (
    <div className="pt-24">
      {/* Hero */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 text-center">
        <FadeIn>
          <div className="inline-flex items-center gap-2 bg-surface-light border border-border rounded-full px-4 py-1.5 mb-6">
            <Play size={14} className="text-accent" />
            <span className="text-sm text-slate-400">See it in action</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            Demos & <span className="gradient-text">Screenshots</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Explore what Multimeter can do — from API testing and mock servers to AI test
            generation and CI/CD integration.
          </p>
        </FadeIn>
      </section>

      {/* Demo grid */}
      <section className="pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {demos.map((demo, index) => (
              <FadeIn key={demo.title} delay={index * 75}>
                <div className="group bg-surface-light border border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
                  {/* Image */}
                  <div className="relative overflow-hidden aspect-video bg-surface">
                    <img
                      src={demo.image}
                      alt={demo.title}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  {/* Content */}
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {demo.title}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed flex-1">
                      {demo.description}
                    </p>
                    {demo.docLink && (
                      <a
                        href={demo.docLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary-light hover:text-primary mt-4 transition-colors"
                      >
                        <ExternalLink size={14} />
                        {demo.docLabel}
                      </a>
                    )}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24 px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="max-w-3xl mx-auto text-center bg-surface-light border border-border rounded-3xl p-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Want to try it yourself?
            </h2>
            <p className="text-slate-400 mb-8">
              Install Multimeter and start testing your APIs in under a minute.
            </p>
            <a
              href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-lg shadow-primary/25"
            >
              Install VS Code Extension
            </a>
          </div>
        </FadeIn>
      </section>
    </div>
  )
}
