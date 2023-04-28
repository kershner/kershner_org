import React, { createContext, useState, useEffect } from "react"
import { calculateNumberOfCells, parseParams } from "../utils/util"


const defaultCellSize = 100;
const defaultNumSquares = calculateNumberOfCells(defaultCellSize);
export const defaultState = {
    numSquares: defaultNumSquares,
    cellSize: defaultCellSize,
    animationEasing: "ease-out",
    animationDelay: 0.1,
    borderStyle: "solid",
    borderColor: "#999",
    borderWidth: 1,
    autoDoodleMode: "random",
    autoDoodleInterval: 200,
    backgroundColor: "#202123",
    luminosity: "light",
    autoDoodle: false,
    colorFade: true,
    mouseDown: false,
    menuOpen: true,
    updatingUrlParams: false
};

const GlobalStateContext = createContext({});

const GlobalStateProvider = ({ children }) => {
    // Parse URL parameters into the initial state
    const paramDict = parseParams();
    const modifiedState = Object.assign(defaultState, paramDict);
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