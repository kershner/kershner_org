import React, { createContext, useState } from "react"
import { calculateNumberOfCells, parseParams, updateUrlParams } from "../utils/util"


const GlobalStateContext = createContext({});

const GlobalStateProvider = ({ children }) => {
    const defaultCellSize = 100;
    const defaultNumSquares = calculateNumberOfCells(defaultCellSize);
    const defaultState = {
        numSquares: defaultNumSquares,
        cellSize: defaultCellSize,
        animationEasing: "ease-out",
        animationDelay: 0.1,
        borderStyle: "solid",
        borderColor: "#999",
        borderWidth: 1,
        autoDoodle: false,
        autoDoodleMode: "random",
        autoDoodleInterval: 200,
        colorFade: true,
        backgroundColor: "#202123",
        luminosity: "light",
        mouseDown: false
    };

    // Parse URL parameters into the initial state
    const paramDict = parseParams();
    const modifiedState = Object.assign(defaultState, paramDict);
    const [globalState, setGlobalState] = useState(modifiedState);

    const updateGlobalState = (key, value, callback) => {
        setGlobalState(prevState => {
            const newState = {...prevState, [key]: value};
            updateUrlParams(newState);
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