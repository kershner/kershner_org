import React, { useContext } from "react"
import { GlobalStateContext } from "./DoodleState";


function DoodleSelectOption(props) {
    return (
        <option value={props.value}>{props.name}</option>
    )
}

export function DoodleSelect(props) {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const inputProps = props.props;
    const options = [];
    for (const key in inputProps.options) {
        options.push(<DoodleSelectOption key={key} value={inputProps.options[key]} name={key}/>)
    }

    return (
        <select name={inputProps.name} onChange={inputProps.handleChange} defaultValue={inputProps.defaultValue}>
            {options}
        </select>
    )
}

export function DoodleControl(props) {
    const inputProps = props.props;
    return (
        <input type={inputProps.inputType}
               id={inputProps.name}
               name={inputProps.name}
               onChange={inputProps.handleChange}
               onMouseUp={inputProps.handleMouseUp ? inputProps.handleMouseUp : undefined}
               onTouchEnd={inputProps.handleTouchEnd ? inputProps.handleTouchEnd : undefined}
               min={inputProps.min ? inputProps.min : "0"}
               max={inputProps.max ? inputProps.max : "200"}
               step={inputProps.step ? inputProps.step : "1"}
               checked={inputProps.checked ? true : false}
               value={inputProps.value}/>
    )
}

export default function DoodleInput(props) {
    let doodleInput = undefined;
    switch (props.inputType) {
        case "select":
            doodleInput = <DoodleSelect props={props}/>;
            break;
        default:
            doodleInput = <DoodleControl props={props}/>;
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

export function DoodleButton(props) {
    const cssClass = `doodle-button ${props.extraClassNames}`;
    return (
        <button id={`doodle-button-${props.id}`}
                className={cssClass}
                onClick={props.onClick}>
            {props.value}
        </button>
    )
}