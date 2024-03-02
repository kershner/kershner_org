import { SongOptionsBtn } from '../SongOptions/SongOptionsBtn/SongOptionsBtn'
import { useMusicPlayerData } from '../../providers/musicPlayerProvider'
import { playAudio, pauseAudio } from '../../utils/util'
import PauseIcon from '../../assets/pause.svg'
import PlayIcon from '../../assets/play.svg'
import { Song } from '../../types/index'
import React from 'react'
import './style.scss'

interface SongRowProps {
  song: Song
}

export const SongRow: React.FC<SongRowProps> = (props) => {
  const {
    songs,
    selectedSong,
    setSelectedSong,
    setHasSelectedSong,
    setPlaying,
    audioRef,
  } = useMusicPlayerData()
  const song = props.song

  const handleClick = (e: React.MouseEvent) => {
    const clickedSongRow = e.currentTarget
    const songId = Number(clickedSongRow.getAttribute('data-songId'))

    if (songId) {
      if (selectedSong && songId === selectedSong.id) {
        if (audioRef.current.paused) {
          playAudio(audioRef, selectedSong, setPlaying)
        } else {
          pauseAudio(audioRef, setPlaying)
        }
      }

      const song = songs.filter((obj) => obj.id === Number(songId))[0]
      setSelectedSong(song)
      setHasSelectedSong(true)
    }
  }

  return (
    <>
      <div
        className={`songRow ${selectedSong?.id === song.id ? 'selected' : ''}`}
        onClick={handleClick}
        data-songId={song.id}
      >
        <div className="songRowColumn">
          <img
            src={`${song.thumbnailUrl}`}
            className="songThumbnail"
            alt={`Thumbnail for the song ${song.name} ${song.artist}`}
            loading="lazy"
          />

          <div className="songName">{song.name}</div>
        </div>

        <div className="songRowColumn">
          <div className="songRowStatusIcon">
            { 
              selectedSong?.id === song.id ? <img src={audioRef.current.paused? PlayIcon : PauseIcon} /> : '' 
            }
          </div>

          <div className="songDuration">{song.duration}</div>
          <SongOptionsBtn />
        </div>
      </div>
    </>
  )
}
