import React, { useEffect, useContext } from "react"
import { GlobalStateContext } from './DoodleState';
import { getNewGridNumCells } from "./ViewportResize"
import { colorSquare } from "./DoodleBoard"


function DoodleControl(props) {
    return (
        <fieldset>
            <div className="label-group">
                <label htmlFor={props.name}>{props.label}:</label>
                <span>{props.value ? props.value : ""}</span>
            </div>

            <input
                type={props.inputType}
                id={props.name}
                name={props.name}
                onChange={props.handleChange}
                onMouseUp={props.mouseUp ? props.mouseUp : undefined}
                min={props.min ? props.min : "0"}
                max={props.max ? props.max : "200"}
                step={props.step ? props.step : "1"}
                checked={props.checked ? true : false}
                value={props.value}
            />
        </fieldset>
    )
}

function CellSizeControl() {
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

    return <DoodleControl inputType="range"
                          name={controlName}
                          label="Cell Size"
                          max="500"
                          min="50"
                          step="10"
                          handleChange={handleChange}
                          mouseUp={handleMouseUp}
                          value={globalState[controlName]}/>;
}

function BorderControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "border";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState.border);
    }

    return <DoodleControl inputType="checkbox"
                          name={controlName}
                          label="Border"
                          handleChange={handleChange}
                          value={globalState[controlName]}
                          checked={globalState[controlName]}/>;
}

function autoDoodle(autoDoodleEnabled, interval, colorFadeEnabled, backgroundColor) {
    clearInterval(window.autoDoodleInterval);

    if (autoDoodleEnabled) {
        window.autoDoodleInterval = setInterval(() => {
            const squares = document.querySelectorAll(".doodle-square");
            const randomSquare = squares[Math.floor(Math.random() * squares.length)];
            colorSquare(randomSquare, colorFadeEnabled, backgroundColor);
        }, interval);
    }
}

function AutoDoodleControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "autoDoodle";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState.autoDoodle, newState => {
            autoDoodle(newState.autoDoodle, newState.autoDoodleInterval, newState.colorFade, newState.backgroundColor);
        });
    }

    return <DoodleControl inputType="checkbox"
                          name={controlName}
                          label="Auto Doodle"
                          handleChange={handleChange}
                          checked={globalState[controlName]}/>;
}

function AutoDoodleIntervalControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "autoDoodleInterval";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, newState => {
            autoDoodle(newState.autoDoodle, newState.autoDoodleInterval, newState.colorFade, newState.backgroundColor);
        });
    }

    return <DoodleControl inputType="range"
                          name={controlName}
                          label="Auto Doodle Interval"
                          step="100"
                          max="2000"
                          min="100"
                          handleChange={handleChange}
                          value={globalState[controlName]}/>;
}

function ColorFadeControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "colorFade";

    function handleChange(e) {
        updateGlobalState(controlName, !globalState.colorFade, newState => {
            autoDoodle(newState.autoDoodle, newState.autoDoodleInterval, newState.colorFade, newState.backgroundColor);
        });
    }

    return <DoodleControl inputType="checkbox"
                          name={controlName}
                          label="Color Fade"
                          handleChange={handleChange}
                          checked={globalState[controlName]}/>;
}

function AnimationControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "animationDelay";

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, newState => {
            autoDoodle(newState.autoDoodle, newState.autoDoodleInterval, newState.colorFade, newState.backgroundColor);
        });
    }

    return <DoodleControl inputType="range"
                          name={controlName}
                          label="Animation"
                          step="0.1"
                          max="2"
                          min="0.1"
                          handleChange={handleChange}
                          value={globalState[controlName]}/>;
}

export default function DoodleControls() {
    return (
        <div className="doodle-controls">
            <fieldset>
                <legend>Descriptive text here.</legend>
                <CellSizeControl />
                <BorderControl />
                <AutoDoodleControl />
                <AutoDoodleIntervalControl />
                <ColorFadeControl />
                <AnimationControl />
            </fieldset>
        </div>
    )
}