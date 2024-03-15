import { useMusicPlayerData } from '../../../providers/musicPlayerProvider'
import { SongOptionsRow } from '../SongOptionsRow/SongOptionsRow'
import { copyToClipboard } from '../../../../../utils/utils'
import { IoCloudDownload } from 'react-icons/io5'
import { IoLogoYoutube } from 'react-icons/io5'
import { IoLink } from 'react-icons/io5'
import './style.scss'

export const SongOptionsMenu = () => {
  const {
    optionsMenuPosition,
    showOptionsMenu,
    optionsMenuRightAlign,
    optionsSong,
  } = useMusicPlayerData()
  const menuPositionStyle = {
    display: showOptionsMenu ? 'unset' : 'none',
    top: optionsMenuPosition.y + 10,
    [optionsMenuRightAlign ? 'right' : 'left']: optionsMenuRightAlign
      ? window.innerWidth - (optionsMenuPosition.x + 10)
      : optionsMenuPosition.x + 10,
  }

  const handleGetLinkClick = () => {
    if (optionsSong) {
      const songId = optionsSong.id
      const currentUrlWithoutParams =
        window.location.origin + window.location.pathname
      const queryParams = new URLSearchParams(window.location.search)
      queryParams.set('song', songId.toString())
      const newUrl = currentUrlWithoutParams + '?' + queryParams.toString()

      copyToClipboard(newUrl)
      alert('URL copied!')
    }
  }

  const handleDownloadClick = () => {
    if (optionsSong) {
      const downloadUrl = optionsSong.url
      window.open(downloadUrl, '_blank')
    }
  }

  const handleYouTubeClick = () => {
    if (optionsSong) {
      const youtubeUrl = optionsSong.youtubeUrl
      window.open(youtubeUrl, '_blank')
    }
  }

  return (
    <>
      <div className="songOptions" style={menuPositionStyle}>
        <SongOptionsRow
          title="Get link"
          icon={IoLink}
          callback={handleGetLinkClick}
        />
        <SongOptionsRow
          title="Download"
          icon={IoCloudDownload}
          callback={handleDownloadClick}
        />
        {optionsSong?.youtubeUrl && (
          <SongOptionsRow
            title="View on YouTube"
            icon={IoLogoYoutube}
            callback={handleYouTubeClick}
          />
        )}
      </div>
    </>
  )
}
