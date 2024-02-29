import { useMusicPlayerData } from '../../providers/musicPlayerProvider';
import { Song } from '../../types/index';
import React from 'react';
import './style.scss';

interface SongRowProps {
    song: Song;
}

export const SongRow: React.FC<SongRowProps> = (props) => {
    const { songs, selectedSong, setSelectedSong, setHasSelectedSong } = useMusicPlayerData();
    const song = props.song;

    const handleClick = (e: React.MouseEvent) => {
        const clickedSongRow = e.target as HTMLElement;
        const songId = clickedSongRow.getAttribute('data-songId');
        if (songId) {
            const song = songs.filter(obj => obj.id === Number(songId))[0];
            setSelectedSong(song);
            setHasSelectedSong(true);
        }
    }

    return (
        <>
            <div className={`songRow ${selectedSong?.id === song.id ? 'selected' : ''}`} onClick={handleClick} data-songId={song.id}>
                <div className='songRowColumn'>
                    <img 
                        // src={song.thumbnailUrl} 
                        className='songThumbnail'
                        src={'https://djfdm802jwooz.cloudfront.net/static/music/thumbnails/3872fb38a3234c479fbaa1058ec93648.jpg'}
                        alt={`Thumbnail for the song ${song.name} ${song.artist}`}
                        loading='lazy' />

                    <div className='songName'>{song.name}</div>
                </div>

                <div className='songRowColumn'>
                    <div className='songDuration'>{song.duration}</div>
                </div>
            </div>
        </>
    )
}