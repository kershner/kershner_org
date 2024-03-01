import React from 'react'
import './style.scss'

interface PlayerButtonProps {
  extraClassName?: string
  dataId?: number
  alt: string
  icon: string
  callback?: (e: React.MouseEvent) => void
}

export const PlayerButton: React.FC<PlayerButtonProps> = (props) => {
  const handleClick = (e: React.MouseEvent) => {
    if (props.callback) {
      props.callback(e)
    }
  }

  return (
    <>
      <button
        className={`playerButton ${props.extraClassName ? props.extraClassName : ''}`}
        title={props.alt}
        data-id={props.dataId}
        onClick={handleClick}
      >
        <img src={props.icon} alt={props.alt} />
      </button>
    </>
  )
}
