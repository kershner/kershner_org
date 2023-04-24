import React, { useEffect, useContext } from "react"
import { GlobalStateContext } from './DoodleState';
import { getNewGridNumCells } from "./ViewportResize"
import { colorSquare } from "./DoodleBoard"


function DoodleSelectOption(props) {
    return (
       <option value={props.value}>{props.value}</option>
    )
}

function DoodleSelect(props) {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const inputProps = props.props;
    const options = [];
    for (let i=0; i<inputProps.options.length; i++) {
        options.push(<DoodleSelectOption key={i} value={inputProps.options[i]} />)
    }

    return (
        <select name={inputProps.name} onChange={inputProps.handleChange} defaultValue={globalState.luminosity}>
            {options}
        </select>
    )
}

function DoodleControl(props) {
    const inputProps = props.props;
    return (
        <input type={inputProps.inputType}
               id={inputProps.name}
               name={inputProps.name}
               onChange={inputProps.handleChange}
               onMouseUp={inputProps.mouseUp ? inputProps.mouseUp : undefined}
               min={inputProps.min ? inputProps.min : "0"}
               max={inputProps.max ? inputProps.max : "200"}
               step={inputProps.step ? inputProps.step : "1"}
               checked={inputProps.checked ? true : false}
               value={inputProps.value} />
    )
}

function DoodleInput(props) {
    let doodleInput = undefined;
    switch (props.inputType) {
        case "select":
            doodleInput = <DoodleSelect props={props} />;
            break;
        default:
            doodleInput = <DoodleControl props={props} />;
            break;
    }

    return (
        <div className="input-group">
            <div className="label-group">
                <label htmlFor={props.name}>{props.label}</label>
            </div>

            { doodleInput }
        </div>
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

function CellSizeControlFieldset() {
    return (
        <fieldset>
            <CellSizeControl />
        </fieldset>
    )
}

function BorderControl() {
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

function BorderControlFieldset() {
    return (
        <fieldset>
            <BorderControl />
        </fieldset>
    )
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

function AutoDoodleControl() {
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

function AutoDoodleIntervalControl() {
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

function AutoDoodleControlFieldset() {
    return (
        <fieldset>
            <AutoDoodleControl />
            <AutoDoodleIntervalControl />
        </fieldset>
    )
}

function ColorFadeControl() {
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

function ColorFadeControlFieldset() {
    return (
        <fieldset>
            <ColorFadeControl />
        </fieldset>
    )
}

function AnimationControl() {
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

function AnimationControlFieldset() {
    return (
        <fieldset>
            <AnimationControl />
        </fieldset>
    )
}

function LuminosityControl() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const controlName = "luminosity";
    const luminosityOptions = [
        'bright',
        'light',
        'dark',
        'all'
    ];

    function handleChange(e) {
        updateGlobalState(controlName, e.target.value, newState => {
            autoDoodle(newState);
        });
    }

    return <DoodleInput inputType="select"
                        name={controlName}
                        label="Luminosity"
                        handleChange={handleChange}
                        options={luminosityOptions} />;
}

function LuminosityControlFieldset() {
    return (
        <fieldset>
            <LuminosityControl />
        </fieldset>
    )
}

export default function DoodleControls() {
    return (
        <div className="doodle-controls">
            <CellSizeControlFieldset />
            <BorderControlFieldset />
            <AutoDoodleControlFieldset />
            <ColorFadeControlFieldset />
            <AnimationControlFieldset />
            <LuminosityControlFieldset />
        </div>
    )
}