import { ChevronDown } from 'lucide-react'
import FadeIn from './FadeIn'
import { faqItems } from '../data/faq'

export default function FAQ() {
  return (
    <section id="faq" className="scroll-mt-20 py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-center text-slate-400 mb-12">
            Multimeter is an AI-powered REST Client for VS Code. It is not an electrical multimeter.
          </p>
        </FadeIn>

        <div className="space-y-3">
          {faqItems.map((item) => (
            <FadeIn key={item.question}>
              <details className="border border-border rounded-xl overflow-hidden group">
                <summary className="cursor-pointer list-none px-6 py-5 text-left hover:bg-surface-light/50 transition-colors flex items-center justify-between gap-4">
                  <span className="text-white font-medium">{item.question}</span>
                  <ChevronDown
                    size={20}
                    className="text-slate-400 shrink-0 transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="px-6 pb-5 text-slate-400 leading-relaxed">{item.answer}</p>
              </details>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
