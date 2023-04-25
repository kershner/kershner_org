import React from "react"
import {
    CellSizeControl, BorderControl, AutoDoodleControl, AutoDoodleIntervalControl,
    ColorFadeControl, AnimationControl, LuminosityControl, BackgroundColorControl
} from "./DoodleControls"


export function CellSizeControlFieldset() {
    return (
        <fieldset>
            <CellSizeControl />
        </fieldset>
    )
}

export function BorderControlFieldset() {
    return (
        <fieldset>
            <BorderControl />
        </fieldset>
    )
}

export function AutoDoodleControlFieldset() {
    return (
        <fieldset>
            <AutoDoodleControl />
            <AutoDoodleIntervalControl />
        </fieldset>
    )
}

export function ColorFadeControlFieldset() {
    return (
        <fieldset>
            <ColorFadeControl />
        </fieldset>
    )
}

export function AnimationControlFieldset() {
    return (
        <fieldset>
            <AnimationControl />
        </fieldset>
    )
}

export function LuminosityControlFieldset() {
    return (
        <fieldset>
            <LuminosityControl />
        </fieldset>
    )
}

export function BackgroundColorControlFieldset() {
    return (
        <fieldset>
            <BackgroundColorControl />
        </fieldset>
    )
}