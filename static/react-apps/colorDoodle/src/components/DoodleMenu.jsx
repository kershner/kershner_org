import React, { useContext } from "react"
import { GlobalStateContext } from "./DoodleState.jsx"
import { DoodleMenuButtonGroupTop, DoodleMenuButtonGroupBottom, ExpandMenuButton } from "./DoodleButtons.jsx"
import {
    BackgroundColorFieldset, GridControlsFieldset, ClickEffectControlsFieldset, AutoControlsFieldset, HoverEffectControlsFieldset
} from "./DoodleFieldsets.jsx"


export function DoodleMenu() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const cssStr = `doodle-controls ${globalState.menuOpen ? "" : "hidden"}`;

    return (
        <div className={cssStr}>
            <fieldset className="doodle-title">
                <div className="fieldset-label">
                    <legend>Color grid settings</legend>
                </div>
            </fieldset>

            <DoodleMenuButtonGroupTop />
            <BackgroundColorFieldset />
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