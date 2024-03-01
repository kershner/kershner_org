import React, { useContext, useEffect } from "react"
import { GlobalStateContext } from "./DoodleState.jsx"
import {
    CellSizeControl, BorderStyleControl, BorderWidthControl, BorderColorControl, AutoDoodleControl,
    AutoDoodleModeControls, AutoDoodleIntervalControl, ColorFadeControl, AutoDoodleAnimationControls,
    LuminosityControl, BackgroundColorControl, ClickEffectEnabledControl, AnimationEasingControl,
    ClickEffectModeControl, ClickEffectAnimationControls, HoverEffectEnabledControl, HoverEffectRadiusControl,
    HoverEffectAnimationControls, AutoDoodleRandomControl, AutoDoodleColorControls, ClickEffectColorControls,
    HoverEffectColorControls
} from "./DoodleControls.jsx"


function CollapsibleFieldsetHeader(props) {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);

    function handleClick(e) {
        const fieldset = e.target.closest("fieldset");
        const statusIcon = e.target.closest(".fieldset-label").querySelector("span");
        const open = !globalState[props.stateValue];
        statusIcon.textContent = open ? "▲" : "▼";
        fieldset.classList.toggle("expanded");

        updateGlobalState(props.stateValue, open);
    }

    return (
        <div className="fieldset-label" onClick={handleClick}>
            <legend>{props.name}</legend>
            <span>{globalState[props.stateValue] ? "▲" : "▼"}</span>
        </div>
    )
}

export function BackgroundColorFieldset() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const toggleStateValue = "clickOpen";

    return (
        <fieldset className="expanded">
            <BackgroundColorControl />
        </fieldset>
    )
}

export function GridControlsFieldset() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const toggleStateValue = "gridOpen";

    return (
        <fieldset className={globalState[toggleStateValue] ? "expanded" : ""}>
            <CollapsibleFieldsetHeader name="Grid" stateValue={toggleStateValue}/>
            <CellSizeControl />
            <BorderStyleControl />
            <BorderWidthControl />
            <BorderColorControl />
        </fieldset>
    )
}

export function ClickEffectControlsFieldset() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const toggleStateValue = "clickOpen";

    return (
        <fieldset className={globalState[toggleStateValue] ? "expanded" : ""}>
            <CollapsibleFieldsetHeader name="Click" stateValue={toggleStateValue}/>
            <ClickEffectEnabledControl />
            <ClickEffectModeControl />
            <ClickEffectAnimationControls />
            <ClickEffectColorControls />
        </fieldset>
    )
}

export function HoverEffectControlsFieldset() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const toggleStateValue = "hoverOpen";

    return (
        <fieldset className={globalState[toggleStateValue] ? "expanded" : ""}>
            <CollapsibleFieldsetHeader name="Hover" stateValue={toggleStateValue}/>
            <HoverEffectEnabledControl />
            <HoverEffectRadiusControl />
            <HoverEffectAnimationControls />
            <HoverEffectColorControls />
        </fieldset>
    )
}

export function AutoControlsFieldset() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const toggleStateValue = "autoOpen";

    return (
        <fieldset className={globalState[toggleStateValue] ? "expanded" : ""}>
            <CollapsibleFieldsetHeader name="Automation" stateValue={toggleStateValue}/>
            <AutoDoodleControl />
            <AutoDoodleModeControls />
            <AutoDoodleAnimationControls />
            <AutoDoodleIntervalControl />
            <AutoDoodleColorControls />
        </fieldset>
    )
}
