import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import FadeIn from './FadeIn'

interface FAQItem {
  question: string
  answer: string
}

const faqItems: FAQItem[] = [
  {
    question: 'How much does Multimeter cost?',
    answer:
      'Multimeter is free for individuals and small businesses (up to 20 users). For teams of 20–50, it costs $2/user/month, and for 50+ users it drops to just $1/user/month. Every plan includes all features — no restrictions.',
  },
  {
    question: 'Do I need to create an account?',
    answer:
      'No. Multimeter requires zero setup — no login, no account, no cloud registration. Install the VS Code extension and start testing immediately. Access control is handled naturally through your Git repository permissions.',
  },
  {
    question: 'How does collaboration work?',
    answer:
      'Your tests are plain YAML files (.mmt) stored in your Git repository alongside your code. Collaboration works exactly like code collaboration — through pull requests, code reviews, branches, and merges. No proprietary sync needed.',
  },
  {
    question: 'How do I use Multimeter in CI/CD?',
    answer:
      'Use the testlight CLI tool. Install it via npm (npm install -g testlight), then run your tests with "npx testlight run path/to/test.mmt". It integrates with any CI/CD system — GitHub Actions, Jenkins, GitLab CI, Azure DevOps, and more.',
  },
  {
    question: 'What formats can I import from?',
    answer:
      'Multimeter can import from Postman collections and OpenAPI (Swagger) specifications. The built-in convertor panel makes migration seamless — just drag and drop your existing files.',
  },
  {
    question: 'Does Multimeter upload any data externally?',
    answer:
      'No. Multimeter is fully local. Your API tests, environment variables, credentials, and all data stay on your machine and in your repository. Nothing is ever sent to external servers.',
  },
  {
    question: 'What protocols are supported?',
    answer:
      'Multimeter supports HTTP/REST, WebSocket, SOAP/XML, and gRPC protocols. You can test any API endpoint with full control over headers, body, authentication, and response validation.',
  },
  {
    question: 'What report formats are available?',
    answer:
      'Multimeter generates reports in four formats: JUnit XML (for CI/CD tools like Jenkins, GitHub Actions, GitLab CI), HTML (self-contained visual reports), Markdown (for PRs and documentation), and MMT Report (YAML format that opens in the built-in viewer). Generate them from the CLI with --report, from the VS Code Export button, or automatically via the suite export: field.',
  },
  {
    question: 'How does the mock server work?',
    answer:
      'Define mock servers as simple YAML files (type: server) with routes, status codes, and response bodies. They support dynamic responses via template variables (params, body, random, date), reflect mode (echo back requests), and both HTTP and WebSocket protocols. Start them from suites with the servers: field, from tests with the run step, or manually from the VS Code panel.',
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-center text-slate-400 mb-12">
            Everything you need to know about Multimeter
          </p>
        </FadeIn>

        <div className="space-y-3">
          {faqItems.map((item, index) => (
            <FadeIn key={index} delay={index * 50}>
              <div className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() =>
                    setOpenIndex(openIndex === index ? null : index)
                  }
                  className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-surface-light/50 transition-colors"
                >
                  <span className="text-white font-medium pr-4">
                    {item.question}
                  </span>
                  <ChevronDown
                    size={20}
                    className={`text-slate-400 shrink-0 transition-transform duration-300 ${
                      openIndex === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openIndex === index ? 'max-h-96' : 'max-h-0'
                  }`}
                >
                  <p className="px-6 pb-5 text-slate-400 leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
