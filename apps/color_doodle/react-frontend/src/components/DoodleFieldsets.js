import React from "react"
import {
    CellSizeControl, BorderStyleControl, BorderWidthControl, BorderColorControl, AutoDoodleControl,
    AutoModeControl, AutoDoodleIntervalControl, ColorFadeControl, AnimationDelayControl, AnimationEasingControl,
    LuminosityControl, BackgroundColorControl, ClickEffectEnabledControl, ClickEffectModeControl,
    ClickEffectAnimationDelayControl, HoverEffectEnabledControl, HoverEffectRadiusControl,
    HoverEffectAnimationDelayControl
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

export function ClickEffectControlsFieldset() {
    return (
        <fieldset>
            <legend>Click effect</legend>
            <ClickEffectEnabledControl />
            <ClickEffectModeControl />
            <ClickEffectAnimationDelayControl />
        </fieldset>
    )
}

export function HoverEffectControlsFieldset() {
    return (
        <fieldset>
            <legend>Hover effect</legend>
            <HoverEffectEnabledControl />
            <HoverEffectRadiusControl />
            <HoverEffectAnimationDelayControl />
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
