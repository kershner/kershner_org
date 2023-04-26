import { colorSquare } from "../components/DoodleBoard"
import { numCols, numRows } from "../utils/util"

export default class AutoDoodle {
    constructor(state) {
        this.state = state;
        this.allSquares = document.querySelectorAll(".doodle-square");
        this.selectableSquares = Array.from(this.allSquares);
    }

    colorSquaresInSequence(collection) {
        let timeOffset = 0;  // ms
        let timeOffsetDelay = 100;
        collection.forEach((element) => {
            setTimeout(() => {
                colorSquare(element, this.state);
            }, timeOffset += timeOffsetDelay)
        });
    }

    rain(rainType, total) {
        const elements = [];
        for (let i=0; i<total; i++) {
            elements.push(document.querySelectorAll(`[data-${rainType}="${i}"]`));
        }

        // pick a row/column at random
        const randomIndex = Math.floor(Math.random() * elements.length);
        this.colorSquaresInSequence(elements[randomIndex]);
    }

    random(fill=false) {
        const randomIndex = Math.floor(Math.random() * this.selectableSquares.length);
        const randomSquare = this.selectableSquares.splice(randomIndex, 1)[0];
        colorSquare(randomSquare, this.state);
    }

    /**
     * Main event loop
     */
    run() {
        clearInterval(window.autoDoodleInterval);

        if (this.state.autoDoodle) {
            window.autoDoodleInterval = setInterval(() => {
                switch (this.state.autoDoodleMode) {
                    case "rainHorizontal":
                        this.rain("row", numRows(this.state.cellSize) + 1);
                        break;
                    case "rainVertical":
                        this.rain("col", numCols(this.state.cellSize));
                        break;
                    default:  // Random
                        this.random();
                        break;
                }

                if (!this.selectableSquares.length) {
                    this.selectableSquares = Array.from(this.allSquares);
                }
            }, this.state.autoDoodleInterval);
        }
    }
}