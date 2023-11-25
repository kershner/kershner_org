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
    autoMode: "rain",
    autoInt: 200,
    autoDur: 0.1,
    autoEase: "ease-out",
    autoRand: true,
    autoFade: true,
    autoLum: "light",
    autoOn: false,
    backgroundColor: "dark",
    luminosity: "light",
    clickMode: "ring",
    clickDur: 0.1,
    clickEase: "ease-out",
    clickFade: true,
    clickLum: "light",
    clickOn: true,
    hoverRadius: 0,
    hoverDur: 0.1,
    hoverEase: "ease-out",
    hoverFade: true,
    hoverLum: "light",
    hoverOn: true,
    mouseDown: false,
    // Menu States
    menuOpen: true,
    autoOpen: true,
    clickOpen: false,
    hoverOpen: false,
    colorOpen: false,
    gridOpen: false
};

const endpoint = window.location.pathname.split('/')[1];
if (!endpoint || endpoint == "music") {
    const kershnerOrgDefaultState = {
        cellSize: 80,
        borderStyle: "hidden",
        autoInt: 1100,
        autoDur: 0.4,
        autoOn: true,
        menuOpen: false
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