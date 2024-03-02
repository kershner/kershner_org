import { useMusicPlayerData } from '../../providers/musicPlayerProvider'
import { applyFilter } from '../../utils/util'
import { SongRow } from '../SongRow/SongRow'
import './style.scss'

export const SongList = () => {
  const {
    songs,
    filteredSongs,
    setFilteredSongs,
    activeFilter,
    setActiveFilter,
  } = useMusicPlayerData()

  const filterClicked = (e: React.MouseEvent) => {
    const targetElement = e.currentTarget
    const filterType = targetElement.getAttribute('data-filter-type')
    if (filterType) {
      applyFilter(filterType, songs, setFilteredSongs, setActiveFilter)
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
