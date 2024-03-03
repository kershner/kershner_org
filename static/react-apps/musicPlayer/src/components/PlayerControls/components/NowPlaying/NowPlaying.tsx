import { SongOptionsBtn } from '../../../SongOptions/SongOptionsBtn/SongOptionsBtn'
import { useMusicPlayerData } from '../../../../providers/musicPlayerProvider'
import './style.scss'

export const NowPlaying = () => {
  const { selectedSong } = useMusicPlayerData()

  return (
    <>
      <div className="nowPlaying">
        <SongOptionsBtn />

        <div className="thumbnail">
          <img src={`${selectedSong?.thumbnailUrl}`} />
        </div>

        <div className="songInfo">
          <div className="songTitle">{selectedSong?.name}</div>
          <div className="songArtist">{selectedSong?.artist}</div>
        </div>
      </div>
    </>
  )
}
