import React from "react"
import {
    CellSizeControlFieldset, BorderControlFieldset, BackgroundColorControlFieldset, AutoDoodleControlFieldset,
    ColorFadeControlFieldset, LuminosityControlFieldset, AnimationControlFieldset
} from "./DoodleFieldsets"


export default function DoodleMenu() {
    return (
        <div className="doodle-controls">
            <CellSizeControlFieldset />
            <BorderControlFieldset />
            <BackgroundColorControlFieldset />
            <AutoDoodleControlFieldset />
            <ColorFadeControlFieldset />
            <LuminosityControlFieldset />
            <AnimationControlFieldset />
        </div>
    )
}