import { calculateNumberOfCells, parseParams } from "../utils/util";
import React, { createContext, useState } from "react";

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

export const defaultState = {
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
    gridBrightness: 1.0,
    // Menu States
    menuOpen: true,
    autoOpen: true,
    clickOpen: false,
    hoverOpen: false,
    colorOpen: false,
    gridOpen: false
};

const GlobalStateContext = createContext({});

const GlobalStateProvider = ({ children }) => {
    const paramDict = parseParams();
    const defaultStateCopy = { ...defaultState };

    // Read the custom default state from the React root data attribute
    const rootElement = document.getElementById("color-grid");
    const customDefaultState = rootElement?.dataset.defaultState
        ? JSON.parse(rootElement.dataset.defaultState)
        : {};

    // Merge states with explicit precedence: paramDict > customDefaultState > defaultStateCopy
    const initialState = {
        ...defaultStateCopy,         // Baseline defaults
        ...customDefaultState,       // Overrides defaults
        ...paramDict                 // Takes highest precedence
    };

    const [globalState, setGlobalState] = useState(initialState);

    const updateGlobalState = (key, value, callback) => {
        setGlobalState(prevState => {
            const newState = { ...prevState, [key]: value };
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

