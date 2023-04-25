import React, { useState, useContext } from "react"
const randomColor = require("randomcolor");
import { GlobalStateContext } from "./DoodleState"
import ViewportResize from "./ViewportResize"


export function colorSquare(squareEl, state) {
    squareEl.addEventListener("transitionend", colorFade);
    squareEl.style.backgroundColor = randomColor({luminosity: state.luminosity});

    function colorFade() {
        if (state.colorFade) {
            squareEl.addEventListener("transitionend", removeColorFade);
            squareEl.style.backgroundColor = "unset";
        }
    }

    function removeColorFade() {
        squareEl.removeEventListener("transitionend", colorFade);
    }
}

function DoodleSquare() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const numColumns = Math.floor(window.innerWidth / globalState.cellSize);
    const divStyle = {
        flexBasis: `${100 / numColumns}%`,
        height: `${globalState.cellSize}px`,
        width: `${globalState.cellSize}px`,
        borderWidth: `${globalState.borderWidth}px`,
        borderRightColor: globalState.borderColor,
        borderBottomColor: globalState.borderColor,
        borderStyle: globalState.borderStyle,
        transition: `background-color ${globalState.animationDelay}s ease-out`
    };

    function handleMouseEnter(e) {
        colorSquare(e.target, globalState);
    }

    function handleMouseLeave(e) {
    }

    function handleClick(e) {
        console.log("clicked!", e);
    }

    return (
        <button style={divStyle}
                className="doodle-square"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}>
        </button>
    );
}

function DoodleSquares() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const doodleSquares = [];
    for (let i=0; i<globalState.numSquares; i++) {
        doodleSquares.push(<DoodleSquare key={i} />);
    }

    return (
        <div className="doodle-squares">
            {doodleSquares}
        </div>
    )
}

export default function DoodleBoard() {
    return (
        <div className="doodle-board">
            <ViewportResize />
            <DoodleSquares />
        </div>
    )
}