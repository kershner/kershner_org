import { PlayerControls } from './components/PlayerControls/PlayerControls'
import { useMusicPlayerData } from './providers/musicPlayerProvider'
import { SongList } from './components/SongList/SongList'
import { useEffect } from 'react'

const App = () => {
  const { fetchInitialData } = useMusicPlayerData()

  useEffect(() => {
    fetchInitialData()
  }, [])

  return (
    <>
      <SongList />
      <PlayerControls />
    </>
  )
}

export default App
