import { colorSquare } from "../components/DoodleBoard"
import { numCols, numRows, shuffleArray } from "../utils/util"
import { colorSquaresInSequence, columnOrRowClick, ringClick } from "../utils/animationHelper"
import { effectTypes } from "../components/DoodleState"


export default class AutoDoodle {
    constructor(state) {
        this.state = state;
        this.allSquares = document.querySelectorAll(".doodle-square");
        this.tempCollection = shuffleArray(Array.from(this.allSquares));
        this.currentlyFilling = true;
        this.effectTypes = shuffleArray(Object.values(effectTypes));
    }

    random(randomSquare, fill = false) {
        let modifiedState = {...this.state};
        const duration = modifiedState.autoDoodleAnimationDuration;
        const easing = modifiedState.autoDoodleAnimationEasing;

        if (fill) {
            modifiedState.colorFade = !this.currentlyFilling;
        }

        colorSquare(randomSquare, modifiedState, null, null, duration, easing);
    }

    effectChoice(effect, square, duration, easing) {
        switch (effect) {
            case "ring":
                ringClick(square, this.state, duration, easing);
                break;
            case "rowAndCol":
                columnOrRowClick(square, this.state, "row", true, duration, easing);
                columnOrRowClick(square, this.state, "col", true, duration, easing);
                break;
            case "row":
                columnOrRowClick(square, this.state, "row", true, duration, easing);
                break;
            case "column":
                columnOrRowClick(square, this.state, "col", true, duration, easing);
                break;
            case "rain":
                columnOrRowClick(square, this.state, "col", false, duration, easing);
                break;
            case "randomFill":
                this.random(square, true);
                break;
            default:  // Random
                this.random(square, false);
                break;
        }
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
                if (!this.effectTypes.length) {
                    this.effectTypes = shuffleArray(Object.values(effectTypes));
                }

                const randomSquare = this.tempCollection.shift();
                const duration = this.state.autoDoodleAnimationDuration;
                const easing = this.state.autoDoodleAnimationEasing;
                let chosenEffect = this.state.autoDoodleMode;

                if (this.state.autoDoodleRandom) {
                    const pct = 0.1;  // effect will switch 10% of the time
                    const pctChance = Math.random() < pct;
                    chosenEffect = pctChance ? this.effectTypes.shift() : this.effectTypes[0];
                }

                this.effectChoice(chosenEffect, randomSquare, duration, easing);

            }, this.state.autoDoodleInterval);
        }
    }
}