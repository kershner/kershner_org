import React, { useContext } from "react"
import { GlobalStateContext } from "./DoodleState";


function DoodleSelectOption(props) {
    return (
        <option value={props.value}>{props.name}</option>
    )
}

function DoodleSelect(props) {
    const inputProps = props.props;
    const options = [];
    for (const key in inputProps.options) {
        options.push(<DoodleSelectOption key={key} value={inputProps.options[key]} name={key}/>)
    }

    return (
        <select name={inputProps.name} onChange={inputProps.handleChange} value={inputProps.defaultValue}>
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
               onMouseUp={inputProps.handleMouseUp ? inputProps.handleMouseUp : undefined}
               onTouchEnd={inputProps.handleTouchEnd ? inputProps.handleTouchEnd : undefined}
               min={inputProps.min ? inputProps.min : "0"}
               max={inputProps.max ? inputProps.max : "200"}
               step={inputProps.step ? inputProps.step : "1"}
               checked={inputProps.checked ? true : false}
               defaultValue={inputProps.defaultValue? defaultValue.value : undefined}
               value={inputProps.value}/>
    )
}

function DoodleRadioChoice(props) {
    return (
        <div className="doodle-radio">
            <input type="radio" id={props.id} value={props.value} name={props.name} onChange={()=>{}} checked={props.checked} value={props.value} />
            <label htmlFor={props.id}>{props.label}</label>
        </div>
    )
}

export function DoodleRadio(props) {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const inputProps = props.props;
    const choices = [];
    for (const key in inputProps.choices) {
        const id = `${key}-choice`;
        const value = inputProps.choices[key];
        const checked = globalState[inputProps.checkedProperty] === value;
        const labelKey = `${key}-label`;
        choices.push(<DoodleRadioChoice  key={labelKey} value={value} name={key} checked={checked} id={id} label={key} />)
    }
    return (
        <div id={inputProps.name} onChange={inputProps.handleChange}>
            { choices }
        </div>
    )
}

export default function DoodleInput(props) {
    let doodleInput = undefined;
    switch (props.inputType) {
        case "select":
            doodleInput = <DoodleSelect props={props}/>;
            break;
        case "radio":
            doodleInput = <DoodleRadio props={props}/>;
            break;
        case "color":
            doodleInput = <DoodleControl props={props}/>;
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