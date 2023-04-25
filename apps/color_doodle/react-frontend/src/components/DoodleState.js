import React, { createContext, useState } from 'react';
import { calculateNumberOfCells } from "./ViewportResize"


const GlobalStateContext = createContext({});

const GlobalStateProvider = ({ children }) => {
    const defaultState = {
        numSquares: calculateNumberOfCells(window.innerHeight, window.innerWidth, 100),
        cellSize: 100,
        animationDelay: 0.1,
        border: true,
        autoDoodle: false,
        autoDoodleInterval: 200,
        colorFade: true,
        backgroundColor: "#202123",
        luminosity: "light"
    };

    const [globalState, setGlobalState] = useState(defaultState);

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