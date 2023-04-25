import React, { useEffect, useContext } from "react"
import { GlobalStateContext } from "./DoodleState"
import getNewGridNumCells from "./ViewportResize"
import colorSquare from "./DoodleBoard"
import DoodleInput from "./DoodleInputs"


export function CellSizeControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "cellSize";

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
                        label="Size"
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

    function handleChange(e) {
        updateGlobalState(controlName, !globalState.border);
    }

    return <DoodleInput inputType="checkbox"
                        name={controlName}
                        label="Grid"
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

    function handleChange(e) {
        updateGlobalState(controlName, !globalState.autoDoodle, newState => {
            autoDoodle(newState);
        });
    }

    return <DoodleInput inputType="checkbox"
                        name={controlName}
                        label="Auto"
                        handleChange={handleChange}
                        checked={globalState[controlName]} />;
}

export function AutoDoodleIntervalControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "autoDoodleInterval";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, newState => {
            autoDoodle(newState);
        });
    }

    return <DoodleInput inputType="range"
                        name={controlName}
                        label="Interval"
                        step="100"
                        max="2000"
                        min="100"
                        handleChange={handleChange}
                        value={globalState[controlName]} />;
}

export function ColorFadeControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "colorFade";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState.colorFade, newState => {
            autoDoodle(newState);
        });
    }

    return <DoodleInput inputType="checkbox"
                        name={controlName}
                        label="Color Fade"
                        handleChange={handleChange}
                        checked={globalState[controlName]} />;
}

export function AnimationControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "animationDelay";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, newState => {
            autoDoodle(newState);
        });
    }

    return <DoodleInput inputType="range"
                        name={controlName}
                        label="Animation"
                        step="0.1"
                        max="2"
                        min="0.1"
                        handleChange={handleChange}
                        value={globalState[controlName]} />;
}

export function LuminosityControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "luminosity";
    const luminosityOptions = {
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
                        label="Luminosity"
                        handleChange={handleChange}
                        options={luminosityOptions}
                        defaultValue={globalState.luminosity} />;
}

export function BackgroundColorControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "backgroundColor";
    const backgroundColorOptions = {
        "light": "#FFF",
        "dark": "#202123"
    };

    function setBackgroundColor(color) {
        const elements = document.querySelectorAll(".doodle-square");
        elements.forEach(element => {
          element.style.backgroundColor = color;
        });
    }

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, newState => {
            setBackgroundColor(newState.backgroundColor);
            autoDoodle(newState);
        });
    }

    return <DoodleInput inputType="select"
                        name={controlName}
                        label="Background"
                        handleChange={handleChange}
                        options={backgroundColorOptions}
                        defaultValue={globalState.backgroundColor} />;
}