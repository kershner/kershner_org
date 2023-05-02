import { colorSquare, defaultColorSquareParams } from "../components/DoodleBoard"
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

        this.effectChangeChance = () => Math.random() < 0.10;
        this.colorFadeChance = () => Math.random() < 0.01;
    }

    random(randomSquare, fill = false) {
        let modifiedState = {...this.state};
        const duration = modifiedState.autoDoodleAnimationDuration;
        const easing = modifiedState.autoDoodleAnimationEasing;

        if (fill) {
            modifiedState.colorFade = !this.currentlyFilling;
        }

        const colorSquareParams = {
            "square": randomSquare,
            "state": modifiedState,
            "duration": duration,
            "easing": easing
        };
        colorSquare({...defaultColorSquareParams, ...colorSquareParams});
    }

    effectChoice(params) {
        const defaultEffectParams = {
            "target": params.square,
            "state": this.state,
            "duration": params.duration,
            "easing": params.easing,
            "colorFade": params.colorFade
        };
        let extraColumnOrRowParams = {
            "type": "col",
            "before": true
        };

        switch (params.effect) {
            case "ring":
                ringClick(defaultEffectParams);
                break;
            case "rowAndCol":
                columnOrRowClick({...extraColumnOrRowParams, ...defaultEffectParams});
                extraColumnOrRowParams.type = "row";
                columnOrRowClick({...extraColumnOrRowParams, ...defaultEffectParams});
                break;
            case "row":
                extraColumnOrRowParams.type = "row";
                columnOrRowClick({...extraColumnOrRowParams, ...defaultEffectParams});
                break;
            case "column":
                columnOrRowClick({...extraColumnOrRowParams, ...defaultEffectParams});
                break;
            case "rain":
                extraColumnOrRowParams.before = false;
                columnOrRowClick({...extraColumnOrRowParams, ...defaultEffectParams});
                break;
            case "randomFill":
                this.random(params.square, true);
                break;
            default:  // Random
                this.random(params.square, false);
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
                let colorFade = this.state.colorFade;

                if (this.state.autoDoodleRandom) {
                    chosenEffect = this.effectChangeChance ? this.effectTypes.shift() : this.effectTypes[0];
                    colorFade = !!this.colorFadeChance;
                }

                const effectParams = {
                    "square": randomSquare,
                    "effect": chosenEffect,
                    "duration": duration,
                    "easing": easing,
                    "colorFade": colorFade
                };
                this.effectChoice(effectParams);
            }, this.state.autoDoodleInterval);
        }
    }
}