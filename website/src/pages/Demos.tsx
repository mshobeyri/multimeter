import FadeIn from '../components/FadeIn'
import PlaylistShowcase from '../components/PlaylistShowcase'
import Seo from '../components/Seo'
import { playlists } from 'virtual:youtube-playlist'

const FEATURED_DEMO_ID = 'lqSktxegPvk'

const demoPlaylist = playlists.find((playlist) => playlist.id === 'PL_GvdPBZ-KR6cTAyzewASaUDbZt_B9POH')

export default function Demos() {
  if (!demoPlaylist) {
    return null
  }

  const featureDemos = {
    ...demoPlaylist,
    videos: demoPlaylist.videos.filter((video) => video.id !== FEATURED_DEMO_ID),
  }

  return (
    <div className="pt-20 pb-16 sm:pt-24 sm:pb-24 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.18),_transparent_32%),linear-gradient(180deg,_rgba(15,23,42,1)_0%,_rgba(8,15,33,1)_100%)]">
      <Seo
        title="Demos — Multimeter"
        description="Watch the Multimeter demo: API tests that live in Git. Then browse short feature videos."
        path="/demos"
      />
      <section className="px-3 pb-10 pt-6 sm:px-6 sm:pb-16 sm:pt-10 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8 sm:space-y-10">
          <FadeIn>
            <section className="scroll-mt-24 space-y-4 rounded-2xl border border-sky-400/35 bg-[linear-gradient(180deg,rgba(14,165,233,0.08),rgba(15,23,42,0.82))] px-3 py-4 shadow-[0_16px_60px_rgba(14,165,233,0.08)] sm:space-y-6 sm:rounded-[34px] sm:px-6 sm:py-7">
              <div className="px-1 sm:px-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-300/90">
                  Demo
                </div>
                <h1 className="mt-3 text-2xl font-semibold text-white sm:text-[2rem]">
                  API Tests That Live in Git
                </h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300 sm:text-[0.98rem]">
                  Silent overview of Multimeter 1.42. Write a YAML API, run a test, commit, then let AI generate{' '}
                  <code className="rounded bg-white/8 px-1.5 py-0.5 text-[0.92em] text-sky-100">.mmt</code> files
                  next to your code.
                </p>
              </div>
              <div className="px-1 pb-1 sm:px-2 sm:pb-2">
                <div className="overflow-hidden rounded-2xl shadow-[0_16px_50px_rgba(2,12,27,0.45)] sm:rounded-[25px]">
                  <div className="relative aspect-video">
                    <iframe
                      className="h-full w-full"
                      src={`https://www.youtube-nocookie.com/embed/${FEATURED_DEMO_ID}?rel=0&modestbranding=1`}
                      title="API Tests That Live in Git | Multimeter Demo 1.42"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            </section>
          </FadeIn>
          <PlaylistShowcase playlist={featureDemos} />
        </div>
      </section>
    </div>
  )
}
