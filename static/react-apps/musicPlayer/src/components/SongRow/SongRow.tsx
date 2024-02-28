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
    const { songs, setSelectedSong, setHasSelectedSong } = useMusicPlayerData();
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

    const handleDownloadClick = (e: React.MouseEvent) => {
        const clickedElement = (e.currentTarget as HTMLElement);
        const clickedDataId = Number(clickedElement.getAttribute('data-id'));
        const song = songs.filter(obj => obj.id === clickedDataId)[0];
        const downloadUrl = song.url;
        window.open(downloadUrl, '_blank');
    }

    const handleYouTubeClick = (e: React.MouseEvent) => {
        const clickedElement = (e.currentTarget as HTMLElement);
        const clickedDataId = Number(clickedElement.getAttribute('data-id'));
        const song = songs.filter(obj => obj.id === clickedDataId)[0];
        const youTubeUrl = song.youtubeUrl;
        window.open(youTubeUrl, '_blank');
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
                    <PlayerButton dataId={song.id} alt={'Download song'} icon={DownloadIcon} callback={handleDownloadClick} />
                    {song.youtubeUrl && 
                    <PlayerButton dataId={song.id} alt={'View song on YouTube'} icon={YoutubeIcon} callback={handleYouTubeClick} />}
                </div>
                
                <div className='songDuration'>{song.duration}</div>
            </div>
        </>
    )
}