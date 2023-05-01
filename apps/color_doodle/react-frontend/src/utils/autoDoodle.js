import { colorSquare } from "../components/DoodleBoard"
import { numCols, numRows, shuffleArray } from "../utils/util"

export default class AutoDoodle {
    constructor(state) {
        this.state = state;
        this.allSquares = document.querySelectorAll(".doodle-square");
        this.tempCollection = shuffleArray(Array.from(this.allSquares));
        this.currentlyFilling = true;
    }

    colorSquaresInSequence(collection) {
        let timeOffset = 0;  // ms
        let timeOffsetDelay = 100;
        collection.forEach((element) => {
            setTimeout(() => {
                colorSquare(element, this.state, null, null, this.state.autoDoodleAnimationDuration, this.state.autoDoodleAnimationEasing);
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
        let modifiedState = { ...this.state };

        if (fill) {
            modifiedState.colorFade = !this.currentlyFilling;
        }

        if (!this.tempCollection.length) {
            this.tempCollection = shuffleArray(Array.from(this.allSquares));
            this.currentlyFilling = !this.currentlyFilling;
        }

        let randomSquare = this.tempCollection.shift();
        colorSquare(randomSquare, modifiedState, null, null, modifiedState.autoDoodleAnimationDuration, modifiedState.autoDoodleAnimationEasing);
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
                    case "randomFill":
                        this.random(true);
                        break;
                    default:  // Random
                        this.random();
                        break;
                }
            }, this.state.autoDoodleInterval);
        }
    }
}