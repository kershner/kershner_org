import React from "react"
import {
    GridControlsFieldset, ColorControlsFieldset, AnimationControlsFieldset, AutoControlsFieldset
} from "./DoodleFieldsets"


export default function DoodleMenu() {
    return (
        <div className="doodle-controls">
            <ColorControlsFieldset />
            <AnimationControlsFieldset />
            <GridControlsFieldset />
            <AutoControlsFieldset />
        </div>
    )
}