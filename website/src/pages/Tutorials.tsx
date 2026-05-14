import PlaylistShowcase from '../components/PlaylistShowcase'
import { playlists } from 'virtual:youtube-playlist'

const tutorialPlaylist = playlists.find((playlist) => playlist.id === 'PL_GvdPBZ-KR4nlMq1dE8BryC75z8jzTfL')

export default function Tutorials() {
  if (!tutorialPlaylist) {
    return null
  }

  return (
    <div className="pt-24 pb-24 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.18),_transparent_32%),linear-gradient(180deg,_rgba(15,23,42,1)_0%,_rgba(8,15,33,1)_100%)]">
      <section className="px-4 pb-16 sm:px-6 lg:px-8 first:pt-10">
        <div className="max-w-7xl mx-auto pt-10">
          <PlaylistShowcase
            playlist={tutorialPlaylist}
            reverseVideos={true}
            useRawTitles={true}
            showPrefixBadge={false}
          />
        </div>
      </section>
    </div>
  )
}