import { useMusicPlayerData } from '../../providers/musicPlayerProvider';
import { PlayerButton } from '../PlayerButton/PlayerButton';
import { useEffect, useRef, useState } from 'react';
import PauseIcon from '../../assets/pause.svg';
import PrevIcon from '../../assets/prev.svg';
import PlayIcon from '../../assets/play.svg';
import NextIcon from '../../assets/next.svg';
import './style.scss';

export const PlayerControls = () => {
    const { songs, selectedSong, setSelectedSong, playing, setPlaying, hasSelectedSong, setHasSelectedSong } = useMusicPlayerData();
    const [progressValue, setProgressValue] = useState(0);
    const [isSliderDragging, setSliderDragging] = useState(false);
    const audioRef = useRef(new Audio());

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const currentTimeDiv = document.querySelector('.currentTime')
        const duration = audioRef.current.duration;
        const pctOfDuration = (parseInt(e.target.value) / 100) * duration;
        const currentTimeFormatted = secondsToHMS(pctOfDuration);
    
        if (currentTimeDiv) {
            currentTimeDiv.innerHTML = currentTimeFormatted;
        }
        setProgressValue(parseInt(e.target.value));
    }

    const handleProgressChangeStart = () => {
        setSliderDragging(true);
    };

    const handleProgressChangeEnd = () => {
        const pctOfDuration = (progressValue / 100) * audioRef.current.duration;
        audioRef.current.currentTime = pctOfDuration;
        setSliderDragging(false);
    };

    const secondsToHMS = (seconds: number) => {
        const hhmmss = new Date(seconds * 1000).toISOString().substr(11, 8);
        return hhmmss.startsWith('00:') ? hhmmss.substr(3) : hhmmss;
    }

    const timeUpdateCallback = (e: Event) => {
        const currentTimeDiv = document.querySelector('.currentTime')
        if (!isSliderDragging && currentTimeDiv) {
            const audioElement = (e.target as HTMLAudioElement)
            const currentTime = audioElement.currentTime;
            const duration = audioElement.duration;
            const progressOutOf100 = (currentTime / duration) * 100;
            const currentTimeFormatted = secondsToHMS(currentTime);
            
            if (!Number.isNaN(duration) && !Number.isNaN(currentTime)) {
                currentTimeDiv.innerHTML = currentTimeFormatted;
                setProgressValue(progressOutOf100);
            }
        }
    }     

    const handlePrevClick = () => {
        if (selectedSong) {
            const currentPosition = songs.findIndex((song) => song.id === selectedSong.id);
            const numSongs = songs.length;
            let prevPosition = currentPosition - 1;
            if (prevPosition < 0) {
                prevPosition = numSongs - 1;
            }

            setSelectedSong(songs[prevPosition]);
        }
    }

    const handlePlayClick = () => {
        setHasSelectedSong(true);
        if (audioRef.current.paused) {
            playAudio();
        } else {
            pauseAudio();
        }
    }

    const handleNextClick = () => {
        if (selectedSong) {
            const currentPosition = songs.findIndex((song) => song.id === selectedSong.id);
            const numSongs = songs.length;
            let nextPosition = currentPosition + 1;
            if (nextPosition === numSongs) {
                nextPosition = 0;
            }

            setSelectedSong(songs[nextPosition]);
        }
    }

    const playAudio = () => {
        if (selectedSong) {
            const audio = audioRef.current;
            audio.pause();
            if (selectedSong.url !== audio.src) {
                audio.src = selectedSong.url;
            }

            audio.play()
            .then(() => {
                setPlaying(true);
            })
            .catch(() => {
                // Handle error eventually
            });
        }
    };

    const pauseAudio = () => {
        if (selectedSong) {
            const audio = audioRef.current;
            audio.pause();
            setPlaying(false);
        }
    }

    useEffect(() => {
        if (hasSelectedSong) {
            playAudio();
        }
    }, [hasSelectedSong, selectedSong]);

    useEffect(() => {
        const audioElement = audioRef.current;
        audioElement.addEventListener('timeupdate', timeUpdateCallback);
        return () => {
          audioElement.removeEventListener('timeupdate', timeUpdateCallback);
        };
      }, [isSliderDragging]);

    return (
        <>
            <div className='playerControls'>
                <div className='nowPlaying'>
                    <div className='thumbnail'>
                        {/* <img src={selectedSong?.thumbnailUrl} /> */}
                        <img src={'https://djfdm802jwooz.cloudfront.net/static/music/thumbnails/3872fb38a3234c479fbaa1058ec93648.jpg'} />
                    </div>

                    <div className='songInfo'>
                        <div className='songTitle'>{selectedSong?.name}</div>
                        <div className='songArtist'>{selectedSong?.artist}</div>
                    </div>
                </div>

                <div className='controlsWrapper'>
                    <div className='time'>
                        <div className='currentTime'>00:00</div>
                        <div className='playerProgressBar'>
                            <input type="range" 
                            value={progressValue}
                            onChange={handleProgressChange} 
                            onMouseDown={handleProgressChangeStart}
                            onMouseUp={handleProgressChangeEnd}
                            onInput={handleProgressChange} />
                        </div>
                        <div className='duration'>{selectedSong?.duration}</div>
                    </div>
                    
                    <div className='controls'>
                        <PlayerButton alt={'Previous song'} icon={PrevIcon} callback={handlePrevClick} />
                        {!playing ? (
                            <PlayerButton alt={'Play song'} icon={PlayIcon} callback={handlePlayClick} />
                        ) : (
                            <PlayerButton alt={'Pause song'} icon={PauseIcon} callback={handlePlayClick} />
                        )}
                        <PlayerButton alt={'Next song'} icon={NextIcon} callback={handleNextClick} />
                    </div>
                </div>
            </div>
        </>
    )
}