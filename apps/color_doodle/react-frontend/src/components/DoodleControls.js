import React, { useContext } from "react"
import { GlobalStateContext } from "./DoodleState"
import { getNewGridNumCells, updateUrlParams } from "../utils/util"
import DoodleInput from "./DoodleInputs"


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
        updateGlobalState("numSquares", getNewGridNumCells(), (newState)=> {
            updateUrlParams(newState);
        });
    }

    function handleTouchEnd(e) {
        updateGlobalState("numSquares", getNewGridNumCells(), (newState)=> {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="range"
                        name={controlName}
                        label={label}
                        max="500"
                        min="50"
                        step="10"
                        handleChange={handleChange}
                        handleMouseUp={handleMouseUp}
                        handleTouchEnd={handleTouchEnd}
                        value={globalState[controlName]} />;
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
        updateGlobalState(controlName, e.target.value, (newState)=> {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="select"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        options={options}
                        defaultValue={globalState[controlName]} />;
}

export function BorderWidthControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "borderWidth";
    const label = "Width";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value);
    }

    function handleMouseUp(e) {
        updateGlobalState(controlName, e.target.value, (newState)=> {
            updateUrlParams(newState);
        });
    }

    function handleTouchEnd(e) {
        updateGlobalState(controlName, e.target.value, (newState)=> {
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
        updateGlobalState(controlName, e.target.value);
    }

    return <DoodleInput inputType="color"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        value={globalState[controlName]}/>;
}

export function AutoDoodleControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "autoDoodle";
    const label = "Enabled";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState.autoDoodle, (newState)=> {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="checkbox"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        checked={globalState[controlName]} />;
}

export function AutoModeControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "autoDoodleMode";
    const label = "Mode";
    const options = {
        "random": "random",
        "random (fill/clear)": "randomFill",
        "rain (vertical)": "rainVertical",
        "rain (horizontal)": "rainHorizontal"
    };

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, (newState)=> {
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

export function AutoDoodleIntervalControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "autoDoodleInterval";
    const label = "Interval";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value);
    }

    function handleMouseUp(e) {
        updateGlobalState(controlName, e.target.value, (newState)=> {
            updateUrlParams(newState);
        });
    }

    function handleTouchEnd(e) {
        updateGlobalState(controlName, e.target.value, (newState)=> {
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
                        value={globalState[controlName]} />;
}

export function ColorFadeControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "colorFade";
    const label = "Fade";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState.colorFade, (newState)=> {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="checkbox"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        checked={globalState[controlName]} />;
}

export function AnimationDelayControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "animationDelay";
    const label = "Delay";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value);
    }

    function handleMouseUp(e) {
        updateGlobalState(controlName, e.target.value, (newState)=> {
            updateUrlParams(newState);
        });
    }

    function handleTouchEnd(e) {
        updateGlobalState(controlName, e.target.value, (newState)=> {
            updateUrlParams(newState);
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
                        value={globalState[controlName]} />;
}

export function AnimationEasingControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "animationEasing";
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
        updateGlobalState(controlName, e.target.value, (newState)=> {
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
        updateGlobalState(controlName, e.target.value, (newState)=> {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="select"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        options={options}
                        defaultValue={globalState[controlName]} />;
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
        updateGlobalState(controlName, e.target.value, (newState)=> {
            updateUrlParams(newState);
        });
    }

    return <DoodleInput inputType="radio"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        choices={choices}
                        checkedProperty={controlName} />;
}