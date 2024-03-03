import {
  playAudio,
  pauseAudio,
  applyFilter,
  scrollSongRowIntoView,
} from '../../utils/util'
import { useMusicPlayerData } from '../../providers/musicPlayerProvider'
import { NowPlaying } from './components/NowPlaying/NowPlaying'
import { PlayerButton } from '../PlayerButton/PlayerButton'
import PauseIcon from '../../assets/pause.svg'
import PrevIcon from '../../assets/prev.svg'
import PlayIcon from '../../assets/play.svg'
import NextIcon from '../../assets/next.svg'
import { useEffect, useState } from 'react'
import { Song } from '../../types'
import './style.scss'

export const PlayerControls = () => {
  const {
    songs,
    selectedSong,
    setSelectedSong,
    playing,
    setPlaying,
    hasSelectedSong,
    setHasSelectedSong,
    audioRef,
    setFilteredSongs,
    setActiveFilter,
  } = useMusicPlayerData()
  const [progressValue, setProgressValue] = useState(0)
  const [isSliderDragging, setSliderDragging] = useState(false)

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentTimeDiv = document.querySelector('.currentTime')
    const duration = audioRef.current.duration
    const pctOfDuration = (parseInt(e.target.value) / 100) * duration
    const currentTimeFormatted = secondsToHMS(pctOfDuration)

    if (currentTimeDiv) {
      currentTimeDiv.innerHTML = currentTimeFormatted
    }
    setProgressValue(parseInt(e.target.value))
  }

  const handleProgressChangeStart = () => {
    setSliderDragging(true)
  }

  const handleProgressChangeEnd = () => {
    const pctOfDuration = (progressValue / 100) * audioRef.current.duration
    audioRef.current.currentTime = pctOfDuration
    setSliderDragging(false)
  }

  const secondsToHMS = (seconds: number) => {
    const hhmmss = new Date(seconds * 1000).toISOString().substr(11, 8)
    return hhmmss.startsWith('00:') ? hhmmss.substr(3) : hhmmss
  }

  const timeUpdateCallback = (e: Event) => {
    const currentTimeDiv = document.querySelector('.currentTime')
    if (!isSliderDragging && currentTimeDiv) {
      const audioElement = e.target as HTMLAudioElement
      const currentTime = audioElement.currentTime
      const duration = audioElement.duration
      const progressOutOf100 = (currentTime / duration) * 100
      const currentTimeFormatted = secondsToHMS(currentTime)

      if (!Number.isNaN(duration) && !Number.isNaN(currentTime)) {
        currentTimeDiv.innerHTML = currentTimeFormatted
        setProgressValue(progressOutOf100)
      }
    }
  }

  const playNextSong = (nextSong: Song) => {
    setSelectedSong(nextSong)
    applyFilter(nextSong.type, songs, setFilteredSongs, setActiveFilter)
    scrollSongRowIntoView(nextSong.id)
  }

  const handlePrevClick = () => {
    if (selectedSong) {
      const currentPosition = songs.findIndex(
        (song) => song.id === selectedSong.id,
      )
      const numSongs = songs.length
      let prevPosition = currentPosition - 1
      if (prevPosition < 0) {
        prevPosition = numSongs - 1
      }

      const nextSong = songs[prevPosition]
      playNextSong(nextSong)
    }
  }

  const handlePlayClick = () => {
    setHasSelectedSong(true)
    if (audioRef.current.paused) {
      playAudio(audioRef, selectedSong, setPlaying)
    } else {
      pauseAudio(audioRef, setPlaying)
    }
  }

  const getNextSong = (songs: Song[], selectedSong: Song) => {
    let nextPosition = 0
    if (selectedSong) {
      const currentPosition = songs.findIndex(
        (song) => song.id === selectedSong.id,
      )
      nextPosition = currentPosition + 1
      if (nextPosition === songs.length) {
        nextPosition = 0
      }
    }
    return songs[nextPosition]
  }

  const handleNextClick = () => {
    if (selectedSong) {
      playNextSong(getNextSong(songs, selectedSong))
    }
  }

  useEffect(() => {
    if (hasSelectedSong) {
      playAudio(audioRef, selectedSong, setPlaying)
    }
  }, [hasSelectedSong, selectedSong])

  useEffect(() => {
    const audioElement = audioRef.current
    audioElement.addEventListener('timeupdate', timeUpdateCallback)
    return () => {
      audioElement.removeEventListener('timeupdate', timeUpdateCallback)
    }
  }, [isSliderDragging])

  useEffect(() => {
    const audioElement = audioRef.current
    audioElement.addEventListener('ended', () => {
      const nextBtn = document.querySelector(
        'button[title="Next song"]',
      ) as HTMLElement
      nextBtn.click()
    })
  }, [])

  return (
    <>
      <div className="playerControls">
        <hr className="playerControlsHr" />

        <div className="playerControlsInner">
          <NowPlaying />

          <div className="controlsWrapper">
            <div className="controls">
              <PlayerButton
                alt={'Previous song'}
                icon={PrevIcon}
                callback={handlePrevClick}
              />
              {!playing ? (
                <PlayerButton
                  alt={'Play song'}
                  icon={PlayIcon}
                  callback={handlePlayClick}
                />
              ) : (
                <PlayerButton
                  alt={'Pause song'}
                  icon={PauseIcon}
                  callback={handlePlayClick}
                />
              )}
              <PlayerButton
                alt={'Next song'}
                icon={NextIcon}
                callback={handleNextClick}
              />
            </div>

            <div className="time">
              <div className="currentTime">00:00</div>
              <div className="playerProgressBar">
                <input
                  type="range"
                  value={progressValue}
                  onChange={handleProgressChange}
                  onMouseDown={handleProgressChangeStart}
                  onMouseUp={handleProgressChangeEnd}
                  onInput={handleProgressChange}
                />
              </div>
              <div className="duration">{selectedSong?.duration}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
