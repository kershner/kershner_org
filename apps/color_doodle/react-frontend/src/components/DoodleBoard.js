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
        borderRightColor: globalState.border ? "#999" : "transparent",
        borderBottomColor: globalState.border ? "#999" : "transparent",
        transition: `background-color ${globalState.animationDelay}s ease-out`
    };

    function mouseEnter(e) {
        colorSquare(e.target, globalState);
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