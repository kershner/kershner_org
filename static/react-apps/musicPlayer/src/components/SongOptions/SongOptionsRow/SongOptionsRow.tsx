import { PlayerButton } from '../../PlayerButton/PlayerButton'
import { IconType } from 'react-icons'
import './style.scss'

interface SongOptionsRowProps {
  title: string
  icon: IconType
  callback?: (e: React.MouseEvent) => void
}

export const SongOptionsRow: React.FC<SongOptionsRowProps> = (props) => {
  return (
    <>
      <div
        className="songOptionRow"
        title={props.title}
        onClick={props.callback}
      >
        <PlayerButton alt={props.title} icon={props.icon} />
        <span>{props.title}</span>
      </div>
    </>
  )
}
