import { PlayerButton } from '../../PlayerButton/PlayerButton'
import './style.scss'

interface SongOptionsRowProps {
  title: string
  icon: string
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
