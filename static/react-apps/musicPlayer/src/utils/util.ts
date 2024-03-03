import { setQueryParam, updateLinksWithQueryParams } from '../../../utils/utils'
import { SetStateAction } from 'react'
import { Song } from '../types'

export const playAudio = (
  audioRef: React.MutableRefObject<HTMLAudioElement>,
  selectedSong: Song | null,
  setPlaying: React.Dispatch<SetStateAction<boolean>>,
) => {
  if (selectedSong) {
    const audio = audioRef.current
    audio.pause()
    if (selectedSong.url !== audio.src) {
      audio.src = selectedSong.url
    }

    audio
      .play()
      .then(() => {
        setPlaying(true)
        setQueryParam('song', selectedSong.id.toString())
        updateLinksWithQueryParams();
      })
      .catch((e) => {
        console.log('error playing audio: ', e)
      })
  }
}

export const pauseAudio = (
  audioRef: React.MutableRefObject<HTMLAudioElement>,
  setPlaying: React.Dispatch<SetStateAction<boolean>>,
) => {
  const audio = audioRef.current
  audio.pause()
  setPlaying(false)
}

export const applyFilter = (
  filterType: string,
  songs: Song[],
  setFilteredSongs: React.Dispatch<React.SetStateAction<Song[]>>,
  setActiveFilter: React.Dispatch<React.SetStateAction<string>>,
) => {
  setFilteredSongs(songs.filter((song) => song.type === filterType))
  setActiveFilter(filterType)
}

export const scrollSongRowIntoView = (songId: number) => {
  setTimeout(() => {
    const songRowToScroll = document.querySelector(
      `.songRow[data-songid="${songId}"]`,
    )
    if (songRowToScroll) {
      songRowToScroll.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, 100)
}
