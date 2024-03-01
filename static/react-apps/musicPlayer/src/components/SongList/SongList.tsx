import { useMusicPlayerData } from '../../providers/musicPlayerProvider'
import { SongRow } from '../SongRow/SongRow'
import { useState } from 'react'
import './style.scss'

export const SongList = () => {
  const { songs, filteredSongs, setFilteredSongs } = useMusicPlayerData()
  const [activeFilter, setActiveFilter] = useState('SO')

  const filterClicked = (e: React.MouseEvent) => {
    const targetElement = e.currentTarget
    const filterType = targetElement.getAttribute('data-filter-type')
    if (filterType) {
      setFilteredSongs(songs.filter((song) => song.type === filterType))
      setActiveFilter(filterType)
    }
  }

  return (
    <>
      <div className="songListFilters">
        <div
          className={`songListFilter ${activeFilter === 'SO' ? 'active' : ''}`}
          data-filter-type="SO"
          onClick={filterClicked}
        >
          <span>Songs</span>
          <span className="songListFilterBottom"></span>
        </div>

        <div
          className={`songListFilter ${activeFilter === 'LO' ? 'active' : ''}`}
          data-filter-type="LO"
          onClick={filterClicked}
        >
          <span>Loops</span>
          <span className="songListFilterBottom"></span>
        </div>

        <div
          className={`songListFilter ${activeFilter === 'OL' ? 'active' : ''}`}
          data-filter-type="OL"
          onClick={filterClicked}
        >
          <span>Old</span>
          <span className="songListFilterBottom"></span>
        </div>
      </div>

      <div className="songList">
        {filteredSongs &&
          filteredSongs.map((song, index) => (
            <SongRow key={index} song={song} />
          ))}
      </div>
    </>
  )
}
