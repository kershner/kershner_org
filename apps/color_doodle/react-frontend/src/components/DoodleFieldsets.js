import React, { useContext, useEffect } from "react"
import { GlobalStateContext } from "./DoodleState"
import { updateUrlParams } from "../utils/util"
import {
    CellSizeControl, BorderStyleControl, BorderWidthControl, BorderColorControl, AutoDoodleControl,
    AutoModeControl, AutoDoodleIntervalControl, ColorFadeControl, AutoDoodleAnimationControls,
    LuminosityControl, BackgroundColorControl, ClickEffectEnabledControl, AnimationEasingControl,
    ClickEffectModeControl, ClickEffectAnimationControls, HoverEffectEnabledControl, HoverEffectRadiusControl,
    HoverEffectAnimationControls, AutoDoodleRandomControl
} from "./DoodleControls"


function CollapsibleFieldsetHeader(props) {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    function handleClick(e) {
        const fieldset = e.target.closest("fieldset");
        const statusIcon = e.target.closest(".fieldset-label").querySelector("span");
        const open = !globalState[props.stateValue];
        statusIcon.textContent = open ? "▲" : "▼";
        fieldset.classList.toggle("expanded");

        updateGlobalState(props.stateValue, open, (newState) => {
            updateUrlParams(newState);
        });
    }

    return (
        <div className="fieldset-label" onClick={handleClick}>
            <legend>{props.name}</legend>
            <span>{globalState[props.stateValue] ? "▲" : "▼"}</span>
        </div>
    )
}

export function GridControlsFieldset() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const toggleStateValue = "gridFieldsetOpen";

    return (
        <fieldset className={globalState[toggleStateValue] ? "expanded" : ""}>
            <CollapsibleFieldsetHeader name="Grid" stateValue={toggleStateValue} />
            <BackgroundColorControl />
            <CellSizeControl />
            <BorderStyleControl />
            <BorderWidthControl />
            <BorderColorControl />
        </fieldset>
    )
}

export function ClickEffectControlsFieldset() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const toggleStateValue = "clickEffectFieldsetOpen";

    return (
        <fieldset className={globalState[toggleStateValue] ? "expanded" : ""}>
            <CollapsibleFieldsetHeader name="Click" stateValue={toggleStateValue} />
            <ClickEffectEnabledControl />
            <ClickEffectModeControl />
            <ClickEffectAnimationControls />
        </fieldset>
    )
}

export function HoverEffectControlsFieldset() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const toggleStateValue = "hoverEffectFieldsetOpen";

    return (
        <fieldset className={globalState[toggleStateValue] ? "expanded" : ""}>
            <CollapsibleFieldsetHeader name="Hover" stateValue={toggleStateValue} />
            <HoverEffectEnabledControl />
            <HoverEffectRadiusControl />
            <HoverEffectAnimationControls />
        </fieldset>
    )
}

export function ColorControlsFieldset() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const toggleStateValue = "colorFieldsetOpen";

    return (
        <fieldset className={globalState[toggleStateValue] ? "expanded" : ""}>
            <CollapsibleFieldsetHeader name="Color" stateValue={toggleStateValue} />
            <ColorFadeControl />
            <LuminosityControl />
        </fieldset>
    )
}

export function AutoControlsFieldset() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const toggleStateValue = "automationFieldsetOpen";

    return (
        <fieldset className={globalState[toggleStateValue] ? "expanded" : ""}>
            <CollapsibleFieldsetHeader name="Automation" stateValue={toggleStateValue} />
            <AutoDoodleControl />
            <AutoModeControl />
            <AutoDoodleAnimationControls />
            <AutoDoodleIntervalControl />
            <AutoDoodleRandomControl />
        </fieldset>
    )
}
