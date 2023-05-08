import React, { useContext } from "react"
import { GlobalStateContext } from "./DoodleState"
import { DoodleMenuButtonGroupTop, CloseMenuButton, DoodleMenuButtonGroupBottom, ExpandMenuButton } from "./DoodleButtons"
import {
    GridControlsFieldset, ClickEffectControlsFieldset, AutoControlsFieldset, HoverEffectControlsFieldset
} from "./DoodleFieldsets"


export function DoodleMenu() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const cssStr = `doodle-controls ${globalState.menuOpen ? "" : "hidden"}`;

    return (
        <div className={cssStr}>
            <DoodleMenuButtonGroupTop />
            <AutoControlsFieldset />
            <ClickEffectControlsFieldset />
            <HoverEffectControlsFieldset />
            <GridControlsFieldset />
            <DoodleMenuButtonGroupBottom />
        </div>
    )
}

export default function DoodleMenuContainer() {
    return (
        <>
            <ExpandMenuButton />
            <DoodleMenu />
        </>
    )
}