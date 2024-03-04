import React, { useContext } from "react"
import { GlobalStateContext, effectTypes, luminosityOptions } from "./DoodleState.jsx"
import { getNewGridNumCells, addOrUpdateQueryParam, updateBackgroundColor } from "../utils/util"
import DoodleInput from "./DoodleInputs.jsx"


// Generic animation controls helpers
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
        updateGlobalState(props.stateValue, e.target.value, () => {
            addOrUpdateQueryParam(props.stateValue, e.target.value);
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
    const controlName = props.stateValue;

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value);
    }

    function handleMouseUp(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            addOrUpdateQueryParam(controlName, newState[controlName]);
        });
    }

    function handleTouchEnd(e) {
        updateGlobalState(props.stateValue, e.target.value, (newState) => {
            addOrUpdateQueryParam(controlName, newState[controlName]);
        });
    }

    return <DoodleInput inputType="range"
                        name={controlName}
                        label={label}
                        step="0.1"
                        max="2"
                        min="0.1"
                        handleChange={handleChange}
                        handleMouseUp={handleMouseUp}
                        handleTouchEnd={handleTouchEnd}
                        value={globalState[controlName]}/>;
}

export function AnimationControls(props) {
    return (
        <div className="input-row animation-controls">
            <AnimationDurationControl stateValue={props.durationStateValue}/>
            <AnimationEasingControl stateValue={props.easingStateValue}/>
        </div>
    )
}

// Generic color controls helpers
export function ColorFadeControl(props) {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const label = "Color fade";
    const controlName = props.stateValue;

    function handleChange(e) {
        const randomEnabled = !globalState[props.stateValue];
        updateGlobalState(controlName, randomEnabled, (newState) => {
            addOrUpdateQueryParam(controlName, randomEnabled);
        });
    }

    return <DoodleInput inputType="checkbox"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        checked={globalState[controlName]}/>;
}

export function LuminosityControl(props) {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const label = "Luminosity";

    function handleChange(e) {
        updateGlobalState(props.stateValue, e.target.value, (newState) => {
            addOrUpdateQueryParam(props.stateValue, e.target.value);
        });
    }

    return <DoodleInput inputType="select"
                        name={props.stateValue}
                        label={label}
                        handleChange={handleChange}
                        options={luminosityOptions}
                        defaultValue={globalState[props.stateValue]}/>;
}

export function ColorControls(props) {
    return (
        <div className="input-row color-controls">
            <LuminosityControl stateValue={props.luminosityStateValue}/>
            <ColorFadeControl stateValue={props.colorFadeStateValue} />
        </div>
    )
}

// Grid controls
export function BackgroundColorControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "backgroundColor";
    const label = "Background";
    const choices = {
        "light": "light",
        "dark": "dark"
    };

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            addOrUpdateQueryParam(controlName, e.target.value);
            updateBackgroundColor(newState);
        });
    }

    return <DoodleInput inputType="radio"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        choices={choices}
                        checkedProperty={controlName}/>;
}

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
            addOrUpdateQueryParam(controlName, newState[controlName]);
        });
    }

    function handleTouchEnd(e) {
        updateGlobalState("numSquares", getNewGridNumCells(), (newState) => {
            addOrUpdateQueryParam(controlName, newState[controlName]);
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
    const label = "Border style";
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
            addOrUpdateQueryParam(controlName, e.target.value);
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
    const label = "Border width";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value);
    }

    function handleMouseUp(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            addOrUpdateQueryParam(controlName, e.target.value);
        });
    }

    function handleTouchEnd(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            addOrUpdateQueryParam(controlName, e.target.value);
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
    const label = "Border color";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            // add a delay so the color picker onChange does not update URL params too often (causes crash)
            window.updateBorderColorTimeout = setTimeout(() => {
                if (newState.borderColor === e.target.value) {
                    addOrUpdateQueryParam(controlName, e.target.value);
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
    const controlName = "autoOn";
    const label = "Enabled";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState[controlName], (newState) => {
            addOrUpdateQueryParam(controlName, newState[controlName]);
        });
    }

    return <DoodleInput inputType="checkbox"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        checked={globalState[controlName]}/>;
}

export function AutoDoodleColorControls() {
    return (
        <ColorControls luminosityStateValue="autoLum" colorFadeStateValue="autoFade"/>
    )
}

export function AutoDoodleModeSelectControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "autoMode";
    const label = "Mode";
    let effectOptions = {...effectTypes};
    delete effectOptions.block;
    effectOptions["random"] = "random";
    effectOptions["random (fill/clear)"] = "randomFill";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            addOrUpdateQueryParam(controlName, e.target.value);
        });
    }

    return <DoodleInput inputType="select"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        options={effectOptions}
                        disabled={globalState.autoRand}
                        defaultValue={globalState[controlName]}/>;
}

export function AutoDoodleRandomControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "autoRand";
    const label = "Random";

    function handleChange(e) {
        const randomEnabled = !globalState[controlName];
        updateGlobalState(controlName, randomEnabled, (newState) => {
            addOrUpdateQueryParam(controlName, randomEnabled);
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
    const controlName = "autoInt";
    const label = "Interval";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value);
    }

    function handleMouseUp(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            addOrUpdateQueryParam(controlName, e.target.value);
        });
    }

    function handleTouchEnd(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            addOrUpdateQueryParam(controlName, e.target.value);
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
        <AnimationControls durationStateValue="autoDur"
                           easingStateValue="autoEase"/>
    )
}

// Click effect controls
export function ClickEffectEnabledControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "clickOn";
    const label = "Enabled";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState[controlName], (newState) => {
            addOrUpdateQueryParam(controlName, !globalState[controlName]);
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
    const controlName = "clickMode";
    const label = "Effect";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            addOrUpdateQueryParam(controlName, e.target.value);
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
        <AnimationControls durationStateValue="clickDur"
                           easingStateValue="clickEase"/>
    )
}

export function ClickEffectColorControls() {
    return (
        <ColorControls luminosityStateValue="clickLum" colorFadeStateValue="clickFade"/>
    )
}

// Hover effect controls
export function HoverEffectEnabledControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "hoverOn";
    const label = "Enabled";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState[controlName], (newState) => {
            addOrUpdateQueryParam(controlName, !globalState[controlName]);
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
    const controlName = "hoverRadius";
    const label = "Radius";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value);
    }

    function handleMouseUp(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            addOrUpdateQueryParam(controlName, e.target.value);
        });
    }

    function handleTouchEnd(e) {
        updateGlobalState(controlName, e.target.value, (newState) => {
            addOrUpdateQueryParam(controlName, e.target.value);
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
        <AnimationControls durationStateValue="hoverDur"
                           easingStateValue="hoverEase"/>
    )
}

export function HoverEffectColorControls() {
    return (
        <ColorControls luminosityStateValue="hoverLum" colorFadeStateValue="hoverFade"/>
    )
}