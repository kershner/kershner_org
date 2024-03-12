import React, { useState, useContext, useEffect } from "react"
import { GlobalStateContext } from "./DoodleState.jsx"
import ViewportResize from "./ViewportResize.jsx"
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
        if (globalState.hoverOn) {
            const params = {
                "square": e.target,
                "offset": parseInt(globalState.hoverRadius),
                "duration": globalState.hoverDur,
                "easing": globalState.hoverEase,
                "colorFade": globalState.hoverFade,
                "luminosity": globalState.hoverLum
            };
            colorAdjacentSquares(params);
        }
    }

    function handleMouseDown(e) {
        if (globalState.clickOn) {
            updateGlobalState("mouseDown", true);
            const effectParams = {
                "square": e.target,
                "effect": globalState.clickMode,
                "duration": globalState.clickDur,
                "easing": globalState.clickEase,
                "colorFade": globalState.clickFade,
                "luminosity": globalState.clickLum,
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

    function handleRightClick(e) {
        e.preventDefault();
    };

    return (
        <button style={divStyle}
                tabIndex="-1"
                className="doodle-square"
                onMouseEnter={handleMouseEnter}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onContextMenu={handleRightClick}
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
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);

    return (
        <div className="doodle-board" style={{ filter: `brightness(${globalState.gridBrightness})` }}>
            <ViewportResize />
            <DoodleSquares />
        </div>
    )
}