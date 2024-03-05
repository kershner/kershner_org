import { SongOptionsMenu } from './components/SongOptions/SongOptionsMenu/SongOptionsMenu'
import {
  applyFilter,
  scrollSongRowIntoView,
  applyFullscreen,
} from '../src/utils/util'
import { PlayerControls } from './components/PlayerControls/PlayerControls'
import { useMusicPlayerData } from './providers/musicPlayerProvider'
import { SongList } from './components/SongList/SongList'
import { parseParams } from '../../utils/utils'
import { Song } from '../src/types'
import { useEffect } from 'react'

const App = () => {
  const {
    fetchInitialData,
    songs,
    setSelectedSong,
    setFilteredSongs,
    setActiveFilter,
    setFullscreen,
    fullscreen,
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

      setSelectedSong(chosenSong)
      applyFilter(chosenSong.type, songs, setFilteredSongs, setActiveFilter)
      scrollSongRowIntoView(chosenSong.id)
    }

    const fullscreenParam = Boolean(params.fullscreen)
    if (fullscreenParam) {
      setFullscreen(fullscreenParam)
    }
  }, [songs])

  useEffect(() => {
    applyFullscreen(fullscreen)
  }, [fullscreen])

  return (
    <>
      <SongOptionsMenu />
      <SongList />
      <PlayerControls />
    </>
  )
}

export default App
