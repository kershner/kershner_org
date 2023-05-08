import { shuffleArray } from "../utils/util"
import { effectChoice } from "../utils/animationHelper"
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
                    "luminosity": this.state.autoDoodleLuminosity,
                    "state": this.state,
                    "currentlyFilling": this.currentlyFilling
                };
                effectChoice(effectParams);
            }, this.state.autoDoodleInterval);
        }
    }
}
