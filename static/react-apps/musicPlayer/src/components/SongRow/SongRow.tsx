import { useMusicPlayerData } from '../../providers/musicPlayerProvider';
import { PlayerButton } from '../PlayerButton/PlayerButton';
import DownloadIcon from '../../assets/download.svg';
import YoutubeIcon from '../../assets/youtube.svg';
import { Song } from '../../types/index';
import React from 'react';
import './style.scss';

interface SongRowProps {
    song: Song;
}

export const SongRow: React.FC<SongRowProps> = (props) => {
    const { songs, setSelectedSong } = useMusicPlayerData();
    const song = props.song;

    const handleClick = (e: React.MouseEvent) => {
        const clickedSongRow = e.target as HTMLElement;
        const songId = Number(clickedSongRow.getAttribute('data-songId'));
        const song = songs.filter(obj => obj.id === songId)[0];
        setSelectedSong(song);
    }

    const handleDownloadClick = (e: React.MouseEvent) => {
        console.log('Download clicked!', e);
    }

    const handleYouTubeClick = (e: React.MouseEvent) => {
        console.log('YouTube clicked!', e);
    }

    return (
        <>
            <div className='songRow' onClick={handleClick} data-songId={song.id}>
                <img 
                    // src={song.thumbnailUrl} 
                    className='songThumbnail'
                    src={'https://djfdm802jwooz.cloudfront.net/static/music/thumbnails/3872fb38a3234c479fbaa1058ec93648.jpg'}
                    alt={`Thumbnail for the song ${song.name} ${song.artist}`}
                    loading='lazy' />

                <div className='songName'>{song.name}</div>

                <div className='songLinks'>
                    <PlayerButton alt={'Download song'} icon={DownloadIcon} callback={handleDownloadClick} />
                    {song.youtubeUrl && 
                    <PlayerButton alt={'View song on YouTube'} icon={YoutubeIcon} callback={handleYouTubeClick} />}
                </div>
                
                <div className='songDuration'>{song.duration}</div>
            </div>
        </>
    )
}