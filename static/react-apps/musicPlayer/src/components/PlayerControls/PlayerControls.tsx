import { useMusicPlayerData } from '../../providers/musicPlayerProvider';
import { PlayerButton } from '../PlayerButton/PlayerButton';
import PauseIcon from '../../assets/pause.svg';
import PrevIcon from '../../assets/prev.svg';
import PlayIcon from '../../assets/play.svg';
import NextIcon from '../../assets/next.svg';
import { useEffect, useRef } from 'react';
import './style.scss';

export const PlayerControls = () => {
    const { selectedSong, playing, setPlaying } = useMusicPlayerData();
    const audioRef = useRef(new Audio());

    const handlePrevClick = (e: React.MouseEvent) => {
        console.log('Prev clicked!', e);
    }

    const handlePlayClick = (e: React.MouseEvent) => {
        console.log('Play clicked!', e);

        if (audioRef.current.paused) {
            playAudio();
        } else {
            pauseAudio();
        }
    }

    const handleNextClick = (e: React.MouseEvent) => {
        console.log('Next clicked!', e);
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
        if (selectedSong) {
            playAudio();
        }
    }, [selectedSong]);

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
                        <div className='currentTime'>0:00</div>
                        <div className='progress'>
                            <input type="range" />
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