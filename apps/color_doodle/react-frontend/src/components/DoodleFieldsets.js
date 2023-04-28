import React from "react"
import {
    CellSizeControl, BorderStyleControl, BorderWidthControl, BorderColorControl, AutoDoodleControl,
    AutoModeControl, AutoDoodleIntervalControl, ColorFadeControl, AnimationDelayControl, AnimationEasingControl,
    LuminosityControl, BackgroundColorControl
} from "./DoodleControls"


export function GridControlsFieldset() {
    return (
        <fieldset>
            <legend>Grid</legend>
            <BackgroundColorControl />
            <CellSizeControl />
            <BorderStyleControl />
            <BorderWidthControl />
            <BorderColorControl />
        </fieldset>
    )
}

export function ColorControlsFieldset() {
    return (
        <fieldset>
            <legend>Color</legend>
            <ColorFadeControl />
            <LuminosityControl />
        </fieldset>
    )
}

export function AnimationControlsFieldset() {
    return (
        <fieldset>
            <legend>Animation</legend>
            <AnimationDelayControl />
            <AnimationEasingControl />
        </fieldset>
    )
}

export function AutoControlsFieldset() {
    return (
        <fieldset>
            <legend>Automation</legend>
            <AutoDoodleControl />
            <AutoModeControl />
            <AutoDoodleIntervalControl />
        </fieldset>
    )
}
