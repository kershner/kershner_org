import React, { useEffect, useState } from "react"
const randomColor = require('randomcolor');
import ViewportResize, { resizeColorGrid, calculateNumberOfCells } from "./ViewportResize"


function DoodleSquare(props) {
    const [color, setColor] = useState("rgb(255, 255, 255");
    const numColumns = Math.floor(window.innerWidth / props.state.cellSize);
    const divStyle = {
        flexBasis: `${100 / numColumns}%`,
        height: `${props.state.cellSize}px`,
        width: `${props.state.cellSize}px`,
        borderColor: props.state.border ? "#999" : "transparent",
        transition: `background-color ${props.state.animationDelay}s ease-out`
    };

    function mouseEnter(e) {
        const colorToSet = randomColor({luminosity: 'light'});
        setColor(colorToSet);
        e.target.style.backgroundColor = colorToSet;
    }

    function mouseLeave(e) {
    }

    return (
        <button style={divStyle}
                className="doodle-square"
                onMouseEnter={mouseEnter}
                onMouseLeave={mouseLeave}>
        </button>
    );
}

function DoodleSquares(props) {
    const doodleSquares = [];
    for (let i=0; i<props.state.numSquares; i++) {
        doodleSquares.push(<DoodleSquare state={props.state} />);
    }

    return (
        <div className="doodle-squares">
            {doodleSquares}
        </div>
    )
}

export default function DoodleBoard(props) {
    return (
        <div className="doodle-board">
            <ViewportResize state={props.state} updateValue={props.updateValue} />
            <DoodleSquares state={props.state} updateValue={props.updateValue} />
        </div>
    )
}