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
    "ring": "ring",
    "wave": "wave"
};

export const luminosityOptions = {
    "bright": "bright",
    "light": "light",
    "dark": "dark",
    "all": "all"
};

export let defaultState = {
    numSquares: defaultNumSquares,
    cellSize: defaultCellSize,
    borderStyle: "solid",
    borderColor: "#999",
    borderWidth: 1,
    autoDoodleMode: "rain",
    autoDoodleInterval: 200,
    autoDoodleAnimationDuration: 0.1,
    autoDoodleAnimationEasing: "ease-out",
    autoDoodleRandom: true,
    autoDoodleColorFade: true,
    autoDoodleLuminosity: "light",
    autoDoodleEnabled: false,
    backgroundColor: "dark",
    luminosity: "light",
    clickEffectMode: "ring",
    clickEffectAnimationDuration: 0.1,
    clickEffectAnimationEasing: "ease-out",
    clickEffectColorFade: true,
    clickEffectLuminosity: "light",
    clickEffectEnabled: true,
    hoverEffectRadius: 0,
    hoverEffectAnimationDuration: 0.1,
    hoverEffectAnimationEasing: "ease-out",
    hoverEffectColorFade: true,
    hoverEffectLuminosity: "light",
    hoverEffectEnabled: true,
    mouseDown: false,
    // Menu States
    menuOpen: true,
    automationFieldsetOpen: true,
    clickEffectFieldsetOpen: false,
    hoverEffectFieldsetOpen: false,
    colorFieldsetOpen: false,
    gridFieldsetOpen: false
};

const endpoint = window.location.pathname.split('/')[1];
if (!endpoint) {
    const kershnerOrgDefaultState = {
        cellSize: 80,
        borderStyle: "hidden",
        autoDoodleInterval: 1100,
        autoDoodleAnimationDuration: 0.4,
        autoDoodleEnabled: true,
        menuOpen: false,
        hoverEffectRadius: 1
    };
    defaultState = {...defaultState, ...kershnerOrgDefaultState};
}

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