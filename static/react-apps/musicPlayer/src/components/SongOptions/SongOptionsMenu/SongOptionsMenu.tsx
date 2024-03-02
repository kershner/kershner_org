import { useMusicPlayerData } from '../../../providers/musicPlayerProvider'
import { SongOptionsRow } from '../SongOptionsRow/SongOptionsRow'
import DownloadIcon from '../../../assets/download.svg'
import YoutubeIcon from '../../../assets/youtube.svg'
import './style.scss'

export const SongOptionsMenu = () => {
  const { songOptionsMenuPosition, showSongOptionsMenu, songOptionsMenuRightAlign, chosenSongOptionsSong } = useMusicPlayerData()
  const menuPositionStyle = {
    display: showSongOptionsMenu ? 'unset' : 'none',
    top: songOptionsMenuPosition.y + 10,
    [songOptionsMenuRightAlign ? 'right' : 'left']: songOptionsMenuRightAlign
      ? window.innerWidth - (songOptionsMenuPosition.x + 10)
      : songOptionsMenuPosition.x + 10,
  };
  
  const handleDownloadClick = () => {
    if (chosenSongOptionsSong) {
      const downloadUrl = chosenSongOptionsSong.url
      window.open(downloadUrl, '_blank')
    }
  }

  const handleYouTubeClick = () => {
    if (chosenSongOptionsSong) {
      const youtubeUrl = chosenSongOptionsSong.youtubeUrl
      window.open(youtubeUrl, '_blank')
    }
  }

  return (
    <>
      <div className="songOptions" style={menuPositionStyle}>
        <SongOptionsRow title='Download' icon={DownloadIcon} callback={handleDownloadClick} />
        <SongOptionsRow title='View on YouTube' icon={YoutubeIcon} callback={handleYouTubeClick} />
      </div>
    </>
  )
}
