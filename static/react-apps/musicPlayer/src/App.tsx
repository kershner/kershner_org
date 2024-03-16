import { SongOptionsMenu } from './components/SongOptions/SongOptionsMenu/SongOptionsMenu'
import {
  applyFilter,
  scrollSongRowIntoView,
  applyFullscreen,
} from '../src/utils/util'
import { PlayerControls } from './components/PlayerControls/PlayerControls'
import { useMusicPlayerData } from './providers/musicPlayerProvider'
import { parseParams, setQueryParam } from '../../utils/utils'
import { SongList } from './components/SongList/SongList'
import { Song } from '../src/types'
import { useEffect } from 'react'

const App = () => {
  const {
    fetchInitialData,
    audioRef,
    songs,
    setSelectedSong,
    setFilteredSongs,
    setActiveFilter,
    setFullscreen,
    fullscreen,
    setRepeat,
    repeat,
    setShuffle,
    shuffle,
  } = useMusicPlayerData()

  // fetch song data once on load
  useEffect(() => {
    fetchInitialData()
  }, [])

  // Code that runs once songs have been fetched
  useEffect(() => {
    const params = parseParams()
    const songParam = params.song
    let chosenSong: Song | null = null

    if (songs.length) {
      if (songParam) {
        chosenSong = songs.filter((obj) => obj.id === Number(songParam))[0]
      } else {
        chosenSong = songs[0]
      }

      audioRef.current.src = chosenSong.url
      setSelectedSong(chosenSong)
      applyFilter(chosenSong.type, songs, setFilteredSongs, setActiveFilter)
      scrollSongRowIntoView(chosenSong.id)
    }

    const fullscreenParam = Boolean(params.fullscreen)
    if (fullscreenParam) {
      setFullscreen(fullscreenParam)
    }

    const repeatParam = Boolean(params.repeat)
    if (repeatParam) {
      setRepeat(repeatParam)
    }

    const shuffleParam = Boolean(params.shuffle)
    if (shuffleParam) {
      setShuffle(shuffleParam)
    }
  }, [songs])

  useEffect(() => {
    applyFullscreen(fullscreen)
  }, [fullscreen])

  useEffect(() => {
    setQueryParam('shuffle', String(shuffle))
  }, [shuffle])

  useEffect(() => {
    setQueryParam('repeat', String(repeat))
  }, [repeat])

  return (
    <>
      <SongOptionsMenu />
      <SongList />
      <PlayerControls />
    </>
  )
}

export default App
