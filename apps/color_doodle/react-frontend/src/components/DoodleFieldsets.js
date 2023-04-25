import React from "react"
import {
    CellSizeControl, BorderControl, AutoDoodleControl, AutoDoodleIntervalControl,
    ColorFadeControl, AnimationControl, LuminosityControl, BackgroundColorControl
} from "./DoodleControls"


export function GridControlsFieldset() {
    return (
        <fieldset>
            <legend>Grid</legend>
            <CellSizeControl />
            <BorderControl />
            <BackgroundColorControl />
        </fieldset>
    )
}

export function ColorControlsFieldset() {
    return (
        <fieldset>
            <legend>Color</legend>
            <ColorFadeControl />
            <AnimationControl />
            <LuminosityControl />
        </fieldset>
    )
}

export function AutoControlsFieldset() {
    return (
        <fieldset>
            <legend>Automation</legend>
            <AutoDoodleControl />
            <AutoDoodleIntervalControl />
        </fieldset>
    )
}
