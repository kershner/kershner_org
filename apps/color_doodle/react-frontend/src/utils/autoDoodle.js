import { colorSquare, defaultColorSquareParams } from "../components/DoodleBoard"
import { numCols, numRows, shuffleArray } from "../utils/util"
import { columnOrRowClick, ringClick } from "../utils/animationHelper"
import { effectTypes } from "../components/DoodleState"


export default class AutoDoodle {
    constructor(state) {
        this.state = state;
        this.allSquares = document.querySelectorAll(".doodle-square");
        this.tempCollection = shuffleArray(Array.from(this.allSquares));
        this.currentlyFilling = true;
        this.effectTypes = shuffleArray(Object.values(effectTypes));
        this.colorFade = this.state.autoDoodleColorFade;

        this.effectChangeChance = () => Math.random() < 0.10;
        this.colorFadeChance = () => Math.random() < 0.20;
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
            "colorFade": params.colorFade,
            "luminosity": params.luminosity
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
        if (this.state.autoDoodleEnabled) {
            window.autoDoodleInterval = setInterval(() => {
                if (!this.tempCollection.length) {
                    this.tempCollection = shuffleArray(Array.from(this.allSquares));
                    this.currentlyFilling = !this.currentlyFilling;
                }
                if (!this.effectTypes.length) {
                    this.effectTypes = shuffleArray(Object.values(effectTypes));
                }

                const randomSquare = this.tempCollection.shift();
                let chosenEffect = this.state.autoDoodleMode;
                let colorFade = this.state.autoDoodleColorFade;

                if (this.state.autoDoodleRandom) {
                    chosenEffect = this.effectChangeChance() ? this.effectTypes.shift() : this.effectTypes[0];
                }

                const effectParams = {
                    "square": randomSquare,
                    "effect": chosenEffect,
                    "duration": this.state.autoDoodleAnimationDuration,
                    "easing": this.state.autoDoodleAnimationEasing,
                    "colorFade": colorFade ? this.colorFadeChance() : colorFade,
                    "luminosity": this.state.autoDoodleLuminosity
                };
                this.effectChoice(effectParams);
            }, this.state.autoDoodleInterval);
        }
    }
}