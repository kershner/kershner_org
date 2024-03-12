import React, { useContext, useEffect } from "react"
import { GlobalStateContext } from "./DoodleState.jsx"
import {
    CellSizeControl, BorderStyleControl, BorderWidthControl, BorderColorControl, AutoDoodleControl,
    AutoDoodleModeControls, AutoDoodleIntervalControl, AutoDoodleAnimationControls,
    BackgroundColorControl, ClickEffectEnabledControl, ClickEffectModeControl, ClickEffectAnimationControls, HoverEffectEnabledControl, HoverEffectRadiusControl,
    HoverEffectAnimationControls, AutoDoodleColorControls, ClickEffectColorControls,
    HoverEffectColorControls, GridBrightnessControl
} from "./DoodleControls.jsx"
import { ClearBoardButton } from "./DoodleButtons.jsx";


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

export function GridBrightnessFieldset() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const customStyles = {
        paddingRight: '0.5rem',
        paddingLeft: '0.75rem',
    }
    return (
        <fieldset className="expanded" style={customStyles}>
            <GridBrightnessControl />
        </fieldset>
    )
}

export function BackgroundColorFieldset() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const customFieldsetStyles = {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingRight: '0.5rem'
    }

    return (
        <fieldset className="expanded" style={customFieldsetStyles}>
            <BackgroundColorControl />
            <ClearBoardButton />
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
