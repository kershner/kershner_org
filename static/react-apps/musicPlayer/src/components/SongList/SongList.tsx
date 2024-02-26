import { useEffect } from 'react';
import { useMusicPlayerData } from '../../providers/musicPlayerProvider';

export const SongList = () => {
    const { songs } = useMusicPlayerData();

    useEffect(() => {
        console.log(songs);
    }, [songs])
    
    return (
        <>
            <div className=''>
                <h1>poop</h1>
            </div>
        </>
    )
}