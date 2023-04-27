import React, { useContext } from "react"
import { GlobalStateContext } from "./DoodleState"
import DoodleTopButtons from "./DoodleTopButtons"
import { CloseMenuButton } from "./DoodleButtons"
import {
    GridControlsFieldset, ColorControlsFieldset, AnimationControlsFieldset, AutoControlsFieldset
} from "./DoodleFieldsets"


export default function DoodleMenu() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const cssStr = `doodle-controls ${globalState.menuOpen ? "" : "hidden"}`;

    return (
        <div className={cssStr}>
            <CloseMenuButton />
            <DoodleTopButtons />
            <ColorControlsFieldset />
            <AnimationControlsFieldset />
            <GridControlsFieldset />
            <AutoControlsFieldset />
        </div>
    )
}