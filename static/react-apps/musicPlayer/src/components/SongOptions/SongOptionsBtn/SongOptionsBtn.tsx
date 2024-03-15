import { useMusicPlayerData } from '../../../providers/musicPlayerProvider'
import { PlayerButton } from '../../PlayerButton/PlayerButton'
import { parents } from '../../../../../utils/utils'
import { IoMenu } from 'react-icons/io5'
import './style.scss'

export const SongOptionsBtn = () => {
  const {
    songs,
    selectedSong,
    setOptionsMenuPosition,
    showOptionsMenu,
    setShowOptionsMenu,
    setOptionsMenuRightAlign,
    optionsSong,
    setOptionsSong,
  } = useMusicPlayerData()

  const getChosenSongId = (songRow: HTMLElement | null) => {
    let songId: number | null = null
    if (songRow) {
      songId = Number(songRow.getAttribute('data-songid'))
    } else if (selectedSong) {
      songId = selectedSong.id
    }
    return songId
  }

  const songOptionsMenu = (e: React.MouseEvent) => {
    e.stopPropagation()

    const { clientX, clientY } = e
    const targetElement = e.target as HTMLElement
    const songRow = parents(targetElement, '.songRow')[0]
    const chosenSongId = getChosenSongId(songRow)
    const nextChosenSong = songs.filter(
      (obj) => obj.id === Number(chosenSongId),
    )[0]
    const clickingSameBtn = nextChosenSong.id === optionsSong?.id
    let toggleState = true

    if (!clickingSameBtn && showOptionsMenu) {
      toggleState = false
    }

    setOptionsSong(nextChosenSong)
    setOptionsMenuPosition({ x: clientX, y: clientY })

    if (!songRow) {
      setOptionsMenuRightAlign(false)
    } else {
      setOptionsMenuRightAlign(true)
    }

    if (toggleState) {
      setShowOptionsMenu(!showOptionsMenu)
    }
  }

  return (
    <>
      <PlayerButton
        alt={'More info'}
        extraClassName={'songOptionsBtn'}
        icon={IoMenu}
        callback={songOptionsMenu}
      />
    </>
  )
}
