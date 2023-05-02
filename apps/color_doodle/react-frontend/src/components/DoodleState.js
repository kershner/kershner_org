import React, { createContext, useState, useContext, useEffect } from "react"
import { calculateNumberOfCells, parseParams } from "../utils/util"


const defaultCellSize = 100;
const defaultNumSquares = calculateNumberOfCells(defaultCellSize);
export const effectTypes = {
    "block": "block",
    "row": "row",
    "column": "column",
    "row and column": "rowAndCol",
    "rain": "rain",
    "ring": "ring"
};
export const defaultState = {
    numSquares: defaultNumSquares,
    cellSize: defaultCellSize,
    borderStyle: "solid",
    borderColor: "#999",
    borderWidth: 1,
    autoDoodleMode: "rain",
    autoDoodleInterval: 200,
    autoDoodleAnimationDuration: 0.1,
    autoDoodleAnimationEasing: "ease-out",
    autoDoodleRandom: false,
    backgroundColor: "#202123",
    luminosity: "light",
    clickEffectMode: "ring",
    clickEffectAnimationDuration: 0.1,
    clickEffectAnimationEasing: "ease-out",
    clickEffectEnabled: true,
    hoverEffectRadius: 0,
    hoverEffectAnimationDuration: 0.1,
    hoverEffectAnimationEasing: "ease-out",
    hoverEffectEnabled: true,
    autoDoodle: false,
    colorFade: true,
    mouseDown: false,
    // Menu States
    menuOpen: true,
    automationFieldsetOpen: true,
    clickEffectFieldsetOpen: false,
    hoverEffectFieldsetOpen: false,
    colorFieldsetOpen: false,
    gridFieldsetOpen: false
};

const GlobalStateContext = createContext({});

const GlobalStateProvider = ({ children }) => {
    // Parse URL parameters into the initial state
    const paramDict = parseParams();
    const defaultStateCopy = {...defaultState};
    const modifiedState = Object.assign(defaultStateCopy, paramDict);
    const [globalState, setGlobalState] = useState(modifiedState);

    const updateGlobalState = (key, value, callback) => {
        setGlobalState(prevState => {
            const newState = {...prevState, [key]: value};
            if (callback) callback(newState);
            return newState;
        });
    };

    return (
        <GlobalStateContext.Provider value={{ globalState, updateGlobalState }}>
            {children}
        </GlobalStateContext.Provider>
    );
};

export { GlobalStateContext, GlobalStateProvider };