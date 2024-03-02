import { useMusicPlayerData } from '../../../providers/musicPlayerProvider'
import { PlayerButton } from '../../PlayerButton/PlayerButton'
import MenuIcon from '../../../assets/burger-menu.svg'
import { parents } from '../../../../../utils/utils';
import './style.scss'

export const SongOptionsBtn = () => {
  const { songs, selectedSong, setSongOptionsMenuPosition, showSongOptionsMenu, setShowSongOptionsMenu, setSongOptionsMenuRightAlign, chosenSongOptionsSong, setChosenSongOptionsSong } = useMusicPlayerData()
  
  const getChosenSongId = (songRow: HTMLElement | null) => {
    let songId: number | null = null;
    if (songRow) {
      songId = Number(songRow.getAttribute('data-songid'));
    } else if (selectedSong) {
      songId = selectedSong.id;
    }
    return songId;
  }
  
  const songOptionsMenu = (e: React.MouseEvent) => {
    e.stopPropagation();

    const { clientX, clientY } = e;
    const targetElement = e.target as HTMLElement
    const songRow = parents(targetElement, '.songRow')[0];
    const chosenSongId = getChosenSongId(songRow);
    const nextChosenSong = songs.filter((obj) => obj.id === Number(chosenSongId))[0];
    const clickingSameBtn = nextChosenSong.id === chosenSongOptionsSong?.id;
    let toggleState = true;
    
    if (!clickingSameBtn && showSongOptionsMenu) {
      toggleState = false;
    }

    setChosenSongOptionsSong(nextChosenSong);
    setSongOptionsMenuPosition({ x: clientX, y: clientY });

    if (!songRow) {
      setSongOptionsMenuRightAlign(false);
    } else {
      setSongOptionsMenuRightAlign(true);
    }

    if (toggleState) {
      setShowSongOptionsMenu(!showSongOptionsMenu);
    }
  }

  return (
    <>
      <PlayerButton
          alt={'More info'}
          extraClassName={'songOptionsBtn'}
          icon={MenuIcon}
          callback={songOptionsMenu}
        />
    </>
  )
}
