import { useState, useEffect, useContext } from "react"
import { GlobalStateContext } from "./DoodleState"


export function calculateNumberOfCells(totalHeight, totalWidth, cellSize) {
    const numberOfRows = Math.floor(totalHeight / cellSize);
    const numberOfColumns = Math.floor(totalWidth / cellSize);
    let totalCells = numberOfRows * numberOfColumns;

    // Adding extra row so grid extends beyond viewport
    totalCells +=  totalCells / numberOfRows;

    return totalCells;
}

export function getNewGridNumCells() {
    const button = document.querySelector(".doodle-square");
    const styles = getComputedStyle(button);
    const buttonSize = parseInt(styles.getPropertyValue("height"), 10);
    return calculateNumberOfCells(window.innerHeight, window.innerWidth, buttonSize);
}

export default function ViewportResize(props) {
    const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);

    useEffect(() => {
        function handleResize() {
            updateGlobalState("numSquares", getNewGridNumCells());
        }

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);
}