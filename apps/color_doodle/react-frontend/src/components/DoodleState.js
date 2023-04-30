import React, { createContext, useState, useContext, useEffect } from "react"
import { calculateNumberOfCells, parseParams } from "../utils/util"


const defaultCellSize = 100;
const defaultNumSquares = calculateNumberOfCells(defaultCellSize);
export const defaultState = {
    numSquares: defaultNumSquares,
    cellSize: defaultCellSize,
    animationEasing: "ease-out",
    animationDuration: 0.1,
    borderStyle: "solid",
    borderColor: "#999",
    borderWidth: 1,
    autoDoodleMode: "random",
    autoDoodleInterval: 200,
    backgroundColor: "#202123",
    luminosity: "light",
    clickEffectMode: "block",
    clickEffectAnimationDuration: 0.1,
    clickEffectEnabled: true,
    hoverEffectRadius: 0,
    hoverEffectAnimationDuration: 0.1,
    hoverEffectEnabled: true,
    autoDoodle: false,
    colorFade: true,
    mouseDown: false,
    menuOpen: true
};

const GlobalStateContext = createContext({});

const GlobalStateProvider = ({ children }) => {
    // Parse URL parameters into the initial state
    const paramDict = parseParams();
    const defaultStateCopy = {...defaultState };
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