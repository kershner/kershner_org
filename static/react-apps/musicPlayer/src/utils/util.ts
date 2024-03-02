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
      })
      .catch(() => {
        // Handle error eventually
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
