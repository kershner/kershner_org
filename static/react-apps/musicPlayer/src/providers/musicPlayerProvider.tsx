import React, { createContext, useContext, useMemo, useState } from 'react';
import { fetchWrapper } from '../utils/util';
import { songDataApiUrl } from '../routes';
import { Song } from '../types';


interface MusicPlayerState {
    fetchInitialData: Function;
    songs: Song[] | null;
    selectedSong: Song | null;
    setSelectedSong: Function;
};
const MusicPlayerContext = createContext({} as MusicPlayerState);

const MusicPlayerProvider = ({ children }: {children: React.ReactNode}) => {
    const [songs, setSongs] = useState<Song[] | null>(null);
    const [selectedSong, setSelectedSong] = useState<Song | null>(null);

    const fetchInitialData = async () => {
        fetchWrapper(songDataApiUrl, 'get', {}, {}, (songData: [Song]) => {
            setSongs(songData);
        })
    };

    const memoValue = useMemo(() => ({
        fetchInitialData,
        songs,
        selectedSong,
        setSelectedSong,
    }), [songs, selectedSong]);

    return <MusicPlayerContext.Provider value={memoValue}>{children}</MusicPlayerContext.Provider>
};

function useMusicPlayerData() {
    return useContext(MusicPlayerContext);
}

export { MusicPlayerProvider, useMusicPlayerData };
