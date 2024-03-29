import React, { useContext } from "react"
import { GlobalStateContext } from "./DoodleState.jsx";


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
        <select id={inputProps.name} name={inputProps.name} onChange={inputProps.handleChange} value={inputProps.defaultValue} disabled={inputProps.disabled}>
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

export function GithubButton() {
    function handleClick(e) {
        const githubUrl = "https://github.com/kershner/kershner_org/tree/master/static/react-apps/colorDoodle";
        window.open(githubUrl, "_blank");
    }

    return (
        <button id="doodle-button-github"
                className="doodle-button"
                title="View the color grid's code"
                onClick={handleClick}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 98 96" style={{width: "100%", height: "100%"}}>
                    <path d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"/>
                </svg>
        </button>
    )
}

export function DoodleButton(props) {
    const cssClass = `doodle-button ${props.extraClassNames}`;
    return (
        <button id={`doodle-button-${props.id}`}
                title={props.value}
                className={cssClass}
                onClick={props.onClick}>
            {props.value}
        </button>
    )
}