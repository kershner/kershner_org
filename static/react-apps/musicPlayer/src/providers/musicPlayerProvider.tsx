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
  getInitialData: () => void
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
  fullscreen: boolean
  setFullscreen: React.Dispatch<SetStateAction<boolean>>
  shuffle: boolean
  setShuffle: React.Dispatch<SetStateAction<boolean>>
  repeat: boolean
  setRepeat: React.Dispatch<SetStateAction<boolean>>
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
  const [fullscreen, setFullscreen] = useState<boolean>(false)
  const [shuffle, setShuffle] = useState<boolean>(false)
  const [repeat, setRepeat] = useState<boolean>(false)

  const getInitialData = async () => {
    const rootElementId = 'kershner-music-player';
    const rootElement = document.getElementById(rootElementId);
    if (!rootElement) {
      console.error(`React root element #${rootElementId} not found.`);
      return;
    }
    const songsData = rootElement.dataset.songs ? JSON.parse(rootElement.dataset.songs) : [];
    setSongs(songsData);
    setFilteredSongs(songsData);
  }

  const memoValue = useMemo(
    () => ({
      getInitialData,
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
      fullscreen,
      setFullscreen,
      shuffle,
      setShuffle,
      repeat,
      setRepeat,
    }),
    [
      songs,
      filteredSongs,
      selectedSong,
      playing,
      hasSelectedSong,
      optionsMenuPosition,
      showOptionsMenu,
      fullscreen,
      shuffle,
      repeat,
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
