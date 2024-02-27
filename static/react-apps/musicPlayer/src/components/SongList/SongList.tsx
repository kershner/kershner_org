import { useMusicPlayerData } from '../../providers/musicPlayerProvider';
import { SongRow } from '../SongRow/SongRow';
import './style.scss';


export const SongList = () => {
    const { songs } = useMusicPlayerData();

    return (
        <>
            <div className='songList'>
                {
                    songs && songs.map((song, index) => (
                        <SongRow key={index} song={song} />
                    ))
                }
            </div>
        </>
    )
}