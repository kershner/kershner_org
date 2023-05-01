import { colorSquare } from "../components/DoodleBoard"
import { numCols, numRows, shuffleArray } from "../utils/util"
import { colorSquaresInSequence, columnOrRowClick, ringClick } from "../utils/animationHelper"


export default class AutoDoodle {
    constructor(state) {
        this.state = state;
        this.allSquares = document.querySelectorAll(".doodle-square");
        this.tempCollection = shuffleArray(Array.from(this.allSquares));
        this.currentlyFilling = true;
    }

    random(fill = false) {
        let modifiedState = {...this.state};

        if (fill) {
            modifiedState.colorFade = !this.currentlyFilling;
        }

        if (!this.tempCollection.length) {
            this.tempCollection = shuffleArray(Array.from(this.allSquares));
            this.currentlyFilling = !this.currentlyFilling;
        }

        let randomSquare = this.tempCollection.shift();
        const duration = modifiedState.autoDoodleAnimationDuration;
        const easing = modifiedState.autoDoodleAnimationEasing;
        colorSquare(randomSquare, modifiedState, null, null, duration, easing);
    }

    /**
     * Main event loop
     */
    run() {
        clearInterval(window.autoDoodleInterval);
        if (this.state.autoDoodle) {
            window.autoDoodleInterval = setInterval(() => {
                if (!this.tempCollection.length) {
                    this.tempCollection = shuffleArray(Array.from(this.allSquares));
                    this.currentlyFilling = !this.currentlyFilling;
                }
                let randomSquare = this.tempCollection.shift();
                const duration = this.state.autoDoodleAnimationDuration;
                const easing = this.state.autoDoodleAnimationEasing;

                switch (this.state.autoDoodleMode) {
                    case "ring":
                        ringClick(randomSquare, this.state, duration, easing);
                        break;
                    case "rowAndCol":
                        columnOrRowClick(randomSquare, this.state, "row", true, duration, easing);
                        columnOrRowClick(randomSquare, this.state, "col", true, duration, easing);
                        break;
                    case "row":
                        columnOrRowClick(randomSquare, this.state, "row", true, duration, easing);
                        break;
                    case "column":
                        columnOrRowClick(randomSquare, this.state, "col", true, duration, easing);
                        break;
                    case "rain":
                        columnOrRowClick(randomSquare, this.state, "col", false, duration, easing);
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