import React, { useContext } from "react"
import { GlobalStateContext } from "./DoodleState"
import { DoodleMenuButtonGroupTop, CloseMenuButton } from "./DoodleButtons"
import {
    GridControlsFieldset, ClickEffectControlsFieldset, ColorControlsFieldset, AnimationControlsFieldset,
    AutoControlsFieldset, HoverEffectControlsFieldset
} from "./DoodleFieldsets"


export default function DoodleMenu() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const cssStr = `doodle-controls ${globalState.menuOpen ? "" : "hidden"}`;

    return (
        <div className={cssStr}>
            <CloseMenuButton />
            <DoodleMenuButtonGroupTop />
            <AutoControlsFieldset />
            <ClickEffectControlsFieldset />
            <HoverEffectControlsFieldset />
            <ColorControlsFieldset />
            <AnimationControlsFieldset />
            <GridControlsFieldset />
        </div>
    )
}