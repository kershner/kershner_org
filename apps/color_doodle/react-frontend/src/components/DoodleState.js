import React, { useState } from "react"
import { calculateNumberOfCells } from "./ViewportResize"

export default function DoodleState() {
    const defaultState = {
        numSquares: calculateNumberOfCells(window.innerHeight, window.innerWidth, 100),
        cellSize: 100,
        animationDelay: 0,
        border: true,
        autoDoodle: false,
        autoDoodleInterval: 200
    };

    const [state, setState] = useState(defaultState);

    const updateValue = (key, newValue) => {
        setState(prevState => ({
            ...prevState,
            [key]: newValue
        }));
    };

    return [state, updateValue]
}