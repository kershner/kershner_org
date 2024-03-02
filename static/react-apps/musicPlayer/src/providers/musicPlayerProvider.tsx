import { fetchWrapper } from '../../../utils/utils'
import { songDataApiUrl } from '../routes'
import { Song, Position } from '../types'
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  SetStateAction,
  useRef,
} from 'react'

interface MusicPlayerState {
  fetchInitialData: () => void
  songs: Song[] | []
  filteredSongs: Song[] | []
  setFilteredSongs: React.Dispatch<SetStateAction<Song[]>>
  activeFilter: string
  setActiveFilter: React.Dispatch<SetStateAction<string>>
  selectedSong: Song | null
  setSelectedSong: React.Dispatch<SetStateAction<Song | null>>
  playing: boolean
  setPlaying: React.Dispatch<SetStateAction<boolean>>
  hasSelectedSong: boolean
  setHasSelectedSong: React.Dispatch<SetStateAction<boolean>>
  audioRef: React.MutableRefObject<HTMLAudioElement>
  optionsMenuPosition: Position
  setOptionsMenuPosition: React.Dispatch<SetStateAction<Position>>
  showOptionsMenu: boolean
  setShowOptionsMenu: React.Dispatch<SetStateAction<boolean>>
  optionsMenuRightAlign: boolean
  setOptionsMenuRightAlign: React.Dispatch<SetStateAction<boolean>>
  optionsSong: Song | null
  setOptionsSong: React.Dispatch<SetStateAction<Song | null>>
}
const MusicPlayerContext = createContext({} as MusicPlayerState)

const MusicPlayerProvider = ({ children }: { children: React.ReactNode }) => {
  const [songs, setSongs] = useState<Song[]>([])
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([])
  const [activeFilter, setActiveFilter] = useState<string>('SO')
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [playing, setPlaying] = useState<boolean>(false)
  const [hasSelectedSong, setHasSelectedSong] = useState<boolean>(false)
  const audioRef = useRef(new Audio())
  const [optionsMenuPosition, setOptionsMenuPosition] = useState<Position>({
    x: 0,
    y: 0,
  })
  const [showOptionsMenu, setShowOptionsMenu] = useState<boolean>(false)
  const [optionsMenuRightAlign, setOptionsMenuRightAlign] =
    useState<boolean>(false)
  const [optionsSong, setOptionsSong] = useState<Song | null>(null)

  const fetchInitialData = async () => {
    fetchWrapper(songDataApiUrl, 'GET', {}, {}, (songData: Song[]) => {
      setSongs(songData)
      setFilteredSongs(songData)
    })
  }

  const memoValue = useMemo(
    () => ({
      fetchInitialData,
      songs,
      filteredSongs,
      setFilteredSongs,
      activeFilter,
      setActiveFilter,
      selectedSong,
      setSelectedSong,
      playing,
      setPlaying,
      hasSelectedSong,
      setHasSelectedSong,
      audioRef,
      optionsMenuPosition,
      setOptionsMenuPosition,
      showOptionsMenu,
      setShowOptionsMenu,
      optionsMenuRightAlign,
      setOptionsMenuRightAlign,
      optionsSong,
      setOptionsSong,
    }),
    [
      songs,
      filteredSongs,
      selectedSong,
      playing,
      hasSelectedSong,
      optionsMenuPosition,
      showOptionsMenu,
    ],
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
