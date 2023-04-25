import React, { useEffect, useContext } from "react"
import { GlobalStateContext } from "./DoodleState"
import { getNewGridNumCells } from "./ViewportResize"
import { colorSquare } from "./DoodleBoard"
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
        updateGlobalState("numSquares", getNewGridNumCells());
    }

    return <DoodleInput inputType="range"
                        name={controlName}
                        label={label}
                        max="500"
                        min="50"
                        step="10"
                        handleChange={handleChange}
                        mouseUp={handleMouseUp}
                        value={globalState[controlName]} />;
}

export function BorderControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "border";
    const label = "Border";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState.border);
    }

    return <DoodleInput inputType="checkbox"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        value={globalState[controlName]}
                        checked={globalState[controlName]} />;
}

function autoDoodle(state) {
    clearInterval(window.autoDoodleInterval);

    if (state.autoDoodle) {
        window.autoDoodleInterval = setInterval(() => {
            const squares = document.querySelectorAll(".doodle-square");
            const randomSquare = squares[Math.floor(Math.random() * squares.length)];
            colorSquare(randomSquare, state);
        }, state.autoDoodleInterval);
    }
}

export function AutoDoodleControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "autoDoodle";
    const label = "Enabled";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState.autoDoodle, newState => {
            autoDoodle(newState);
        });
    }

    return <DoodleInput inputType="checkbox"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        checked={globalState[controlName]} />;
}

export function AutoDoodleIntervalControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "autoDoodleInterval";
    const label = "Interval";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, newState => {
            autoDoodle(newState);
        });
    }

    return <DoodleInput inputType="range"
                        name={controlName}
                        label={label}
                        step="100"
                        max="2000"
                        min="100"
                        handleChange={handleChange}
                        value={globalState[controlName]} />;
}

export function ColorFadeControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "colorFade";
    const label = "Fade";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState.colorFade, newState => {
            autoDoodle(newState);
        });
    }

    return <DoodleInput inputType="checkbox"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        checked={globalState[controlName]} />;
}

export function AnimationControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "animationDelay";
    const label = "Animation";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, newState => {
            autoDoodle(newState);
        });
    }

    return <DoodleInput inputType="range"
                        name={controlName}
                        label={label}
                        step="0.1"
                        max="2"
                        min="0.1"
                        handleChange={handleChange}
                        value={globalState[controlName]} />;
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
        updateGlobalState(controlName, e.target.value, newState => {
            autoDoodle(newState);
        });
    }

    return <DoodleInput inputType="select"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        options={options}
                        defaultValue={globalState.luminosity} />;
}

export function BackgroundColorControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "backgroundColor";
    const label = "Background";
    const options = {
        "light": "#FFF",
        "dark": "#202123"
    };

    function setBackgroundColor(color) {
        document.body.style.backgroundColor = color;
    }

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, newState => {
            setBackgroundColor(newState.backgroundColor);
            autoDoodle(newState);
        });
    }

    return <DoodleInput inputType="select"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        options={options}
                        defaultValue={globalState.backgroundColor} />;
}