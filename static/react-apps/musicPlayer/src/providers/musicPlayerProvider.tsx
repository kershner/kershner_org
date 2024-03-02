import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  SetStateAction,
  useEffect,
  useRef,
} from 'react'
import { fetchWrapper } from '../../../utils/utils'
import { songDataApiUrl } from '../routes'
import { Song, Position } from '../types'

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
  audioRef: React.MutableRefObject<HTMLAudioElement>
  songOptionsMenuPosition: Position
  setSongOptionsMenuPosition: React.Dispatch<SetStateAction<Position>>
  showSongOptionsMenu: boolean
  setShowSongOptionsMenu: React.Dispatch<SetStateAction<boolean>>
  songOptionsMenuRightAlign: boolean
  setSongOptionsMenuRightAlign: React.Dispatch<SetStateAction<boolean>>
  chosenSongOptionsSong: Song | null
  setChosenSongOptionsSong: React.Dispatch<SetStateAction<Song | null>>
}
const MusicPlayerContext = createContext({} as MusicPlayerState)

const MusicPlayerProvider = ({ children }: { children: React.ReactNode }) => {
  const [songs, setSongs] = useState<Song[]>([])
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([])
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [playing, setPlaying] = useState<boolean>(false)
  const [hasSelectedSong, setHasSelectedSong] = useState<boolean>(false)
  const audioRef = useRef(new Audio())
  const [songOptionsMenuPosition, setSongOptionsMenuPosition] = useState<Position>({ x: 0, y: 0 });
  const [showSongOptionsMenu, setShowSongOptionsMenu] = useState<boolean>(false);
  const [songOptionsMenuRightAlign, setSongOptionsMenuRightAlign] = useState<boolean>(false);
  const [chosenSongOptionsSong, setChosenSongOptionsSong] = useState<Song | null>(null);

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
      songOptionsMenuPosition,
      setSongOptionsMenuPosition,
      showSongOptionsMenu,
      setShowSongOptionsMenu,
      songOptionsMenuRightAlign,
      setSongOptionsMenuRightAlign,
      chosenSongOptionsSong,
      setChosenSongOptionsSong
    }),
    [songs, filteredSongs, selectedSong, playing, hasSelectedSong, songOptionsMenuPosition, showSongOptionsMenu],
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
