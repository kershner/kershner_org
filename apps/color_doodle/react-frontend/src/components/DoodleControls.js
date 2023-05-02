import React, { useContext } from "react"
import { GlobalStateContext, effectTypes } from "./DoodleState"
import { getNewGridNumCells, updateUrlParams } from "../utils/util"
import DoodleInput from "./DoodleInputs"


// Generic animation helpers
export function AnimationEasingControl(props) {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const label = "Easing";
    const options = {
        "linear": "linear",
        "ease": "ease",
        "ease-in": "ease-in",
        "ease-out": "ease-out",
        "ease-in-out": "ease-in-out",
        "step-start": "step-start",
        "step-end": "step-end"
    };

    function handleChange(e) {
        updateGlobalState(props.stateValue, e.target.value, (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="select"
                        name={props.stateValue}
                        label={label}
                        handleChange={handleChange}
                        options={options}
                        defaultValue={globalState[props.stateValue]}/>;
}

export function AnimationDurationControl(props) {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const label = "Animation";

    function handleChange(e) {
        updateGlobalState(props.stateValue, e.target.value);
    }

    function handleMouseUp(e) {
        updateGlobalState(props.stateValue, e.target.value, (newState) => {
            updateUrlParams(newState);
        });
    }

    function handleTouchEnd(e) {
        updateGlobalState(props.stateValue, e.target.value, (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="range"
                        name={props.stateValue}
                        label={label}
                        step="0.1"
                        max="2"
                        min="0.1"
                        handleChange={handleChange}
                        handleMouseUp={handleMouseUp}
                        handleTouchEnd={handleTouchEnd}
                        value={globalState[props.stateValue]}/>;
}

export function AnimationControls(props) {
    return (
        <div className="input-row animation-controls">
            <AnimationDurationControl stateValue={props.durationStateValue}/>
            <AnimationEasingControl stateValue={props.easingStateValue}/>
        </div>
    )
}


// Grid controls
export function CellSizeControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "cellSize";
    const label = "Cell size";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, ()=> {
            updateGlobalState("numSquares", getNewGridNumCells());
        });
    }

    function handleMouseUp(e) {
        updateGlobalState("numSquares", getNewGridNumCells(), (newState) => {
            updateUrlParams(newState);
        });
    }

    function handleTouchEnd(e) {
        updateGlobalState("numSquares", getNewGridNumCells(), (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="range"
                        name={controlName}
                        label={label}
                        max="350"
                        min="50"
                        step="10"
                        handleChange={handleChange}
                        handleMouseUp={handleMouseUp}
                        handleTouchEnd={handleTouchEnd}
                        value={globalState[controlName]}/>;
}

export function BorderStyleControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "borderStyle";
    const label = "Style";
    const options = {
        "hidden": "hidden",
        "dotted": "dotted",
        "dashed": "dashed",
        "solid": "solid",
        "double": "double",
        "groove": "groove",
        "ridge": "ridge",
        "inset": "inset",
        "outset": "outset"
    };

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="select"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        options={options}
                        defaultValue={globalState[controlName]}/>;
}

export function BorderWidthControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "borderWidth";
    const label = "Width";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value);
    }

    function handleMouseUp(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            updateUrlParams(newState);
        });
    }

    function handleTouchEnd(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="range"
                        name={controlName}
                        label={label}
                        max="20"
                        min="1"
                        step="1"
                        handleChange={handleChange}
                        handleMouseUp={handleMouseUp}
                        handleTouchEnd={handleTouchEnd}
                        value={globalState[controlName]}/>;
}

export function BorderColorControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "borderColor";
    const label = "Color";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            // add a delay so the color picker onChange does not update URL params too often (causes crash)
            window.updateBorderColorTimeout = setTimeout(() => {
                if (newState.borderColor === e.target.value) {
                    updateUrlParams(newState);
                }
            }, 100);
        });
    }

    return <DoodleInput inputType="color"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        value={globalState[controlName]}/>;
}

// Auto mode controls
export function AutoDoodleControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "autoDoodle";
    const label = "Enabled";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState[controlName], (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="checkbox"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        checked={globalState[controlName]}/>;
}

export function AutoDoodleModeSelectControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "autoDoodleMode";
    const label = "Mode";
    let effectOptions = {...effectTypes};
    delete effectOptions.block;
    effectOptions["random"] = "random";
    effectOptions["random (fill/clear)"] = "randomFill";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="select"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        options={effectOptions}
                        disabled={globalState.autoDoodleRandom}
                        defaultValue={globalState[controlName]}/>;
}

export function AutoDoodleRandomControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "autoDoodleRandom";
    const label = "Random";

    function handleChange(e) {
        const randomEnabled = !globalState[controlName];
        updateGlobalState(controlName, randomEnabled, (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="checkbox"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        checked={globalState[controlName]}/>;
}

export function AutoDoodleModeControls() {
    return (
        <div className="input-row">
            <AutoDoodleModeSelectControl />
            <AutoDoodleRandomControl />
        </div>
    )
}

export function AutoDoodleIntervalControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "autoDoodleInterval";
    const label = "Interval";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value);
    }

    function handleMouseUp(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            updateUrlParams(newState);
        });
    }

    function handleTouchEnd(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="range"
                        name={controlName}
                        label={label}
                        step="100"
                        max="2000"
                        min="100"
                        handleChange={handleChange}
                        handleMouseUp={handleMouseUp}
                        handleTouchEnd={handleTouchEnd}
                        value={globalState[controlName]}/>;
}

export function AutoDoodleAnimationControls() {
    return (
        <AnimationControls durationStateValue="autoDoodleAnimationDuration"
                           easingStateValue="autoDoodleAnimationEasing"/>
    )
}

// Color controls
export function ColorFadeControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "colorFade";
    const label = "Fade";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState[controlName], (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="checkbox"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        checked={globalState[controlName]}/>;
}

export function LuminosityControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "luminosity";
    const label = "Luminosity";
    const options = {
        "bright": "bright",
        "light": "light",
        "dark": "dark",
        "all": "all"
    };

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="select"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        options={options}
                        defaultValue={globalState[controlName]}/>;
}

export function BackgroundColorControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "backgroundColor";
    const label = "Background";
    const choices = {
        "light": "#FFF",
        "dark": "#202123"
    };

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="radio"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        choices={choices}
                        checkedProperty={controlName}/>;
}

// Click effect controls
export function ClickEffectEnabledControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "clickEffectEnabled";
    const label = "Enabled";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState[controlName], (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="checkbox"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        checked={globalState[controlName]}/>;
}

export function ClickEffectModeControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "clickEffectMode";
    const label = "Effect";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="select"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        options={effectTypes}
                        defaultValue={globalState[controlName]}/>;
}

export function ClickEffectAnimationControls() {
    return (
        <AnimationControls durationStateValue="clickEffectAnimationDuration"
                           easingStateValue="clickEffectAnimationEasing"/>
    )
}

// Hover effect controls
export function HoverEffectEnabledControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "hoverEffectEnabled";
    const label = "Enabled";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState[controlName], (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="checkbox"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        checked={globalState[controlName]}/>;
}

export function HoverEffectRadiusControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "hoverEffectRadius";
    const label = "Radius";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value);
    }

    function handleMouseUp(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            updateUrlParams(newState);
        });
    }

    function handleTouchEnd(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="range"
                        name={controlName}
                        label={label}
                        step="1"
                        max="3"
                        min="0"
                        handleChange={handleChange}
                        handleMouseUp={handleMouseUp}
                        handleTouchEnd={handleTouchEnd}
                        value={globalState[controlName]}/>;
}

export function HoverEffectAnimationControls() {
    return (
        <AnimationControls durationStateValue="hoverEffectAnimationDuration"
                           easingStateValue="hoverEffectAnimationEasing"/>
    )
}