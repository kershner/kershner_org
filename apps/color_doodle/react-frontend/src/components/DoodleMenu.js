import React from "react"
import {
    GridControlsFieldset, ColorControlsFieldset, AutoControlsFieldset
} from "./DoodleFieldsets"


export default function DoodleMenu() {
    return (
        <div className="doodle-controls">
            <ColorControlsFieldset />
            <GridControlsFieldset />
            <AutoControlsFieldset />
        </div>
    )
}