import React from "react"
import { resizeColorGrid } from "./ViewportResize"

function DoodleControl(props) {
    return (
        <p>
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
                checked={props.checked ? "checked" : undefined}
                value={props.value}
            />
        </p>
    )
}

function CellSizeControl(props) {
    const controlName = "cellSize";

    function handleChange(e) {
        props.updateValue(controlName, e.target.value);
        resizeColorGrid(props);
    }

    function handleMouseUp(e) {
        resizeColorGrid(props);
    }

    return <DoodleControl inputType="range"
                          name={controlName}
                          label="Cell Size"
                          max="200"
                          min="50"
                          step="10"
                          handleChange={handleChange}
                          mouseUp={handleMouseUp}
                          value={props.state.cellSize} />;
}

function BorderControl(props) {
    const controlName = "border";

    function handleChange(e) {
        props.updateValue(controlName, !props.state.border);
    }

    return <DoodleControl inputType="checkbox"
                          name={controlName}
                          label="Border"
                          handleChange={handleChange}
                          value={props.state.border}
                          checked={props.state.border} />;
}

function AnimationControl(props) {
    const controlName = "animationDelay";

    function handleChange(e) {
        props.updateValue(controlName, e.target.value);
    }

    return <DoodleControl inputType="range"
                          name={controlName}
                          label="Animation"
                          step="0.1"
                          max="2"
                          handleChange={handleChange}
                          value={props.state.animationDelay} />;
}

export default function DoodleControls(props) {
    return (
        <div className="doodle-controls">
            <fieldset>
            <legend>Descriptive text here.</legend>
                <CellSizeControl state={props.state} updateValue={props.updateValue} />
                <BorderControl state={props.state} updateValue={props.updateValue} />
                <AnimationControl state={props.state} updateValue={props.updateValue} />
            </fieldset>
        </div>
    )
}