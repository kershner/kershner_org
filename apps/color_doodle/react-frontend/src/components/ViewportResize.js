import { useState, useEffect } from "react";


export function calculateNumberOfCells(totalHeight, totalWidth, cellSize) {
    const numberOfRows = Math.floor(totalHeight / cellSize);
    const numberOfColumns = Math.floor(totalWidth / cellSize);
    return numberOfRows * numberOfColumns;
}

export function resizeColorGrid(props) {
    const button = document.querySelector(".doodle-square");
    const styles = getComputedStyle(button);
    const buttonSize = parseInt(styles.getPropertyValue("height"), 10);
    const numCells = calculateNumberOfCells(window.innerHeight, window.innerWidth, buttonSize);
    props.updateValue("numSquares", numCells);
}

export default function ViewportResize(props) {
    const [viewportWidth, setViewportWidth] = useState(window.innerWidth);

    useEffect(() => {
        function handleResize() {
            resizeColorGrid(props);
        }

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);
}