import React, { useState, useContext, useEffect } from "react"
import { GlobalStateContext } from "./DoodleState"
import ViewportResize from "./ViewportResize"
import { numCols } from "../utils/util"
import { effectChoice, colorAdjacentSquares } from "../utils/animationHelper"


function DoodleSquare(props) {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const divStyle = {
        flexBasis: `${100 / numCols(globalState.cellSize) }%`,
        height: `${globalState.cellSize}px`,
        borderWidth: `${globalState.borderWidth}px`,
        borderRightColor: globalState.borderColor,
        borderBottomColor: globalState.borderColor,
        borderStyle: globalState.borderStyle
    };

    function handleMouseEnter(e) {
        if (globalState.hoverEffectEnabled) {
            const params = {
                "square": e.target,
                "offset": parseInt(globalState.hoverEffectRadius),
                "duration": globalState.hoverEffectAnimationDuration,
                "easing": globalState.hoverEffectAnimationEasing,
                "colorFade": globalState.hoverEffectColorFade,
                "luminosity": globalState.hoverEffectLuminosity
            };
            colorAdjacentSquares(params);
        }
    }

    function handleMouseDown(e) {
        if (globalState.clickEffectEnabled) {
            updateGlobalState("mouseDown", true);
            const effectParams = {
                "square": e.target,
                "effect": globalState.clickEffectMode,
                "duration": globalState.clickEffectAnimationDuration,
                "easing": globalState.clickEffectAnimationEasing,
                "colorFade": globalState.clickEffectColorFade,
                "luminosity": globalState.clickEffectLuminosity,
                "state": globalState
            };
            effectChoice(effectParams);
        }
    }

    function handleMouseUp(e) {
        updateGlobalState("mouseDown", false);
    }

    function handleTouchStart(e) {
        handleMouseDown(e);
    }

    function handleTouchEnd(e) {
        handleMouseUp(e);
    }

    return (
        <button style={divStyle}
                className="doodle-square"
                onMouseEnter={handleMouseEnter}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            {...props.dataAttrs} >
        </button>
    );
}

function DoodleSquares() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const doodleSquares = [];
    for (let i = 0; i < globalState.numSquares; i++) {
        const row = Math.floor(i / numCols(globalState.cellSize));
        const col = i % numCols(globalState.cellSize);
        const dataAttrs = {
            'data-row': row,
            'data-col': col
        };

        doodleSquares.push(<DoodleSquare key={i} dataAttrs={dataAttrs}/>);
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