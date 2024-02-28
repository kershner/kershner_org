// import { useMusicPlayerData } from '../../providers/musicPlayerProvider';
import React from 'react';
import './style.scss';

interface PlayerButtonProps {
    dataId?: number;
    alt: string;
    icon: string;
    callback?: (e:  React.MouseEvent) => void;
}

export const PlayerButton : React.FC<PlayerButtonProps> = (props) => {
    const handleClick = (e: React.MouseEvent) => {
        if (props.callback) {
            props.callback(e);
        }
    }
    
    return (
        <>
            <img className='playerButton' src={props.icon} alt={props.alt} title={props.alt} data-id={props.dataId} onClick={handleClick} />
        </>
    )
}