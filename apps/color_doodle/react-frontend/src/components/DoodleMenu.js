import React from "react"
import DoodleTopButtons from "./DoodleTopButtons"
import {
    GridControlsFieldset, ColorControlsFieldset, AnimationControlsFieldset, AutoControlsFieldset
} from "./DoodleFieldsets"


export default function DoodleMenu() {
    return (
        <div className="doodle-controls">
            <DoodleTopButtons />
            <ColorControlsFieldset />
            <AnimationControlsFieldset />
            <GridControlsFieldset />
            <AutoControlsFieldset />
        </div>
    )
}