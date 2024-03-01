import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  SetStateAction,
  useEffect,
  useRef,
} from 'react'
import { fetchWrapper } from '../utils/util'
import { songDataApiUrl } from '../routes'
import { Song } from '../types'

interface MusicPlayerState {
  fetchInitialData: () => void
  songs: Song[] | []
  filteredSongs: Song[] | []
  setFilteredSongs: React.Dispatch<SetStateAction<Song[]>>
  selectedSong: Song | null
  setSelectedSong: React.Dispatch<SetStateAction<Song | null>>
  playing: boolean
  setPlaying: React.Dispatch<SetStateAction<boolean>>
  hasSelectedSong: boolean
  setHasSelectedSong: React.Dispatch<SetStateAction<boolean>>
  audioRef: React.MutableRefObject<HTMLAudioElement> // Add audioRef to the context
}
const MusicPlayerContext = createContext({} as MusicPlayerState)

const MusicPlayerProvider = ({ children }: { children: React.ReactNode }) => {
  const [songs, setSongs] = useState<Song[]>([])
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([])
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [playing, setPlaying] = useState<boolean>(false)
  const [hasSelectedSong, setHasSelectedSong] = useState<boolean>(false)
  const audioRef = useRef(new Audio()) // Initialize audioRef

  const fetchInitialData = async () => {
    fetchWrapper(songDataApiUrl, 'GET', {}, {}, (songData: Song[]) => {
      setSongs(songData)
      setFilteredSongs(songData)
    })
  }

  useEffect(() => {
    const firstSong: Song | null = songs[0]
    if (firstSong) {
      setSelectedSong(firstSong)
    }
  }, [songs])

  const memoValue = useMemo(
    () => ({
      fetchInitialData,
      songs,
      filteredSongs,
      setFilteredSongs,
      selectedSong,
      setSelectedSong,
      playing,
      setPlaying,
      hasSelectedSong,
      setHasSelectedSong,
      audioRef,
    }),
    [songs, filteredSongs, selectedSong, playing, hasSelectedSong],
  )

  return (
    <MusicPlayerContext.Provider value={memoValue}>
      {children}
    </MusicPlayerContext.Provider>
  )
}

function useMusicPlayerData() {
  return useContext(MusicPlayerContext)
}

export { MusicPlayerProvider, useMusicPlayerData }
