import PlaylistShowcase from '../components/PlaylistShowcase'
import { playlists } from 'virtual:youtube-playlist'

const demoPlaylist = playlists.find((playlist) => playlist.id === 'PL_GvdPBZ-KR6cTAyzewASaUDbZt_B9POH')

export default function Demos() {
  if (!demoPlaylist) {
    return null
  }

  return (
    <div className="pt-20 pb-16 sm:pt-24 sm:pb-24 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.18),_transparent_32%),linear-gradient(180deg,_rgba(15,23,42,1)_0%,_rgba(8,15,33,1)_100%)]">
      <section className="px-3 pb-10 pt-6 sm:px-6 sm:pb-16 sm:pt-10 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <PlaylistShowcase playlist={demoPlaylist} />
        </div>
      </section>
    </div>
  )
}
