import { SongOptionsBtn } from '../../../SongOptions/SongOptionsBtn/SongOptionsBtn'
import { useMusicPlayerData } from '../../../../providers/musicPlayerProvider'
import { PlayerButton } from '../../../PlayerButton/PlayerButton'
import { AiOutlineFullscreen } from 'react-icons/ai'
import './style.scss'

export const NowPlaying = () => {
  const { selectedSong, setFullscreen, fullscreen } = useMusicPlayerData()

  const fullscreenAction = () => {
    setFullscreen(!fullscreen)
  }

  return (
    <>
      <div className="nowPlaying">
        <SongOptionsBtn />
        <PlayerButton
          alt={'Fullscreen'}
          extraClassName={'fullscreenBtn'}
          icon={AiOutlineFullscreen}
          callback={fullscreenAction}
        />

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
