import { Play, ExternalLink, Youtube } from 'lucide-react'
import FadeIn from '../components/FadeIn'
import { PLAYLIST_ID, videos as playlistVideos } from 'virtual:youtube-playlist'

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

      {/* Step-by-step videos */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 bg-surface-light border border-border rounded-full px-4 py-1.5 mb-3">
                  <Youtube size={14} className="text-red-500" />
                  <span className="text-sm text-slate-400">Step-by-step playlist</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">
                  Watch Multimeter in <span className="gradient-text">action</span>
                </h2>
                <p className="text-slate-400 mt-2 max-w-2xl">
                  Short, focused videos walking through Multimeter — from install to
                  environment variables and API testing.
                </p>
              </div>
              <a
                href={`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary-light hover:text-primary transition-colors"
              >
                <ExternalLink size={14} />
                View full playlist on YouTube
              </a>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {playlistVideos.map((video, index) => (
              <FadeIn key={video.id} delay={index * 75}>
                <div className="group bg-surface-light border border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
                  <div className="relative aspect-video bg-surface">
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube-nocookie.com/embed/${video.id}?list=${PLAYLIST_ID}`}
                      title={video.title}
                      loading="lazy"
                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {video.title}
                    </h3>
                    <a
                      href={`https://www.youtube.com/watch?v=${video.id}&list=${PLAYLIST_ID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary-light hover:text-primary mt-auto transition-colors"
                    >
                      <Youtube size={14} />
                      Watch on YouTube
                    </a>
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
