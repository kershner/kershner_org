import { colorSquare } from "../components/DoodleBoard"
import { numCols, numRows } from "../utils/util"

export default class AutoDoodle {
    constructor(state) {
        this.state = state;
        this.allSquares = document.querySelectorAll(".doodle-square");
        this.currentlyFilling = true;
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
        let collection = this.allSquares;
        let modifiedState = { ...this.state };

        if (fill) {
            // Get  collection of squares, either all transparent or all non-transparent
            collection = Array.from(this.allSquares).filter(el => {
                const transparentBg = "rgba(0, 0, 0, 0)";
                const computedStyle = window.getComputedStyle(el);
                if (this.currentlyFilling) {
                    return computedStyle.backgroundColor === transparentBg;
                } else {
                    return computedStyle.backgroundColor !== transparentBg;
                }
            });

            // When all squares have been addressed, flip the fill mode and re-set the collection
            if (!collection.length) {
                collection = Array.from(this.allSquares);
                this.currentlyFilling = !this.currentlyFilling;
                this.run();
            }

            modifiedState.colorFade = !this.currentlyFilling;
        }

        let randomIndex = Math.floor(Math.random() * collection.length);
        let randomSquare = collection[randomIndex];

        colorSquare(randomSquare, modifiedState);
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