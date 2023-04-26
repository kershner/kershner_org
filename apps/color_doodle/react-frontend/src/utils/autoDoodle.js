import { colorSquare } from "../components/DoodleBoard"

export default class AutoDoodle {
    constructor(state) {
        this.state = state;
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

    run() {
        clearInterval(window.autoDoodleInterval);

        if (this.state.autoDoodle) {
            // for random mode
            let allSquares = document.querySelectorAll(".doodle-square");
            let selectableSquares = Array.from(allSquares);

            window.autoDoodleInterval = setInterval(() => {
                switch (this.state.autoDoodleMode) {
                    case "rainHorizontal":
                        const numberOfRows = Math.floor(window.innerHeight / this.state.cellSize) + 1;
                        this.rain("row", numberOfRows);
                        break;
                    case "rainVertical":
                        const numberOfColumns = Math.floor(window.innerWidth / this.state.cellSize);
                        this.rain("col", numberOfColumns);
                        break;
                    default:  // Random
                        const randomIndex = Math.floor(Math.random() * selectableSquares.length);
                        const randomSquare = selectableSquares.splice(randomIndex, 1)[0];
                        colorSquare(randomSquare, this.state);
                        break;
                }

                if (!selectableSquares.length) {
                    selectableSquares = Array.from(allSquares);
                }
            }, this.state.autoDoodleInterval);
        }
    }
}