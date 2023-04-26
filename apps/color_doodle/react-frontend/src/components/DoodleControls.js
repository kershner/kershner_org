import React, { useContext } from "react"
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
            updateGlobalState("numSquares", getNewGridNumCells(), newState => {
                autoDoodle(newState);
            });
        });
    }

    function handleMouseUp(e) {
        updateGlobalState("numSquares", getNewGridNumCells(), newState => {
            autoDoodle(newState);
        });
    }

    function handleTouchEnd(e) {
        updateGlobalState("numSquares", getNewGridNumCells(), newState => {
            autoDoodle(newState);
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
    const label = "Border Style";
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
        updateGlobalState(controlName, e.target.value, newState => {
            autoDoodle(newState);
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
    const label = "Border width";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value);
    }

    return <DoodleInput inputType="range"
                        name={controlName}
                        label={label}
                        max="20"
                        min="1"
                        step="1"
                        handleChange={handleChange}
                        value={globalState[controlName]}/>;
}


// Auto Doodle stuff, probably should be in its own function ///////////////////////////////////////////////////////////
function colorSquaresInSequence(collection, state) {
    let timeOffset = 0;  // ms
    let timeOffsetDelay = 100;
    collection.forEach((element) => {
        setTimeout(() => {
            colorSquare(element, state);
        }, timeOffset += timeOffsetDelay)
    });
}

function autoDoodle(state) {
    clearInterval(window.autoDoodleInterval);

    if (state.autoDoodle) {
        // for random mode
        let allSquares = document.querySelectorAll(".doodle-square");
        let selectableSquares = Array.from(allSquares);

        window.autoDoodleInterval = setInterval(() => {
            switch (state.autoDoodleMode) {
                case "rainHorizontal":
                    const numberOfRows = Math.floor(window.innerHeight / state.cellSize) + 1;
                    rain("row", numberOfRows, state);
                    break;
                case "rainVertical":
                    const numberOfColumns = Math.floor(window.innerWidth / state.cellSize);
                    rain("col", numberOfColumns, state);
                    break;
                default:  // Random
                    const randomIndex = Math.floor(Math.random() * selectableSquares.length);
                    const randomSquare = selectableSquares.splice(randomIndex, 1)[0];
                    colorSquare(randomSquare, state);
                    break;
            }

            if (!selectableSquares.length) {
                selectableSquares = Array.from(allSquares);
            }
        }, state.autoDoodleInterval);
    }

    function rain(rainType, total, state) {
        // pick a row/column at random
        const elements = [];
        for (let i=0; i<total; i++) {
            elements.push(document.querySelectorAll(`[data-${rainType}="${i}"]`));
        }
        const randomIndex = Math.floor(Math.random() * elements.length);
        colorSquaresInSequence(elements[randomIndex], state);
    }
}
// Auto Doodle stuff, probably should be in its own function ///////////////////////////////////////////////////////////

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

export function AutoModeControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "autoDoodleMode";
    const label = "Mode";
    const options = {
        "random": "random",
        "rain (vertical)": "rainVertical",
        "rain (horizontal)": "rainHorizontal"
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
                        defaultValue={globalState[controlName]}/>;
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

export function AnimationDelayControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "animationDelay";
    const label = "Delay";

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
        updateGlobalState(controlName, e.target.value, newState => {
            autoDoodle(newState);
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
        updateGlobalState(controlName, e.target.value, newState => {
            autoDoodle(newState);
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
    const options = {
        "light": "#FFF",
        "dark": "#202123"
    };

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, newState => {
            document.body.style.backgroundColor = newState.backgroundColor;
            autoDoodle(newState);
        });
    }

    return <DoodleInput inputType="select"
                        name={controlName}
                        label={label}
                        handleChange={handleChange}
                        options={options}
                        defaultValue={globalState[controlName]} />;
}