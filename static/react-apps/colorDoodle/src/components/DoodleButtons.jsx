import React, { useContext } from "react"
import { GlobalStateContext, getDefaultState } from "./DoodleState.jsx"
import { DoodleButton, GithubButton } from "./DoodleInputs.jsx"
import { getNewGridNumCells, removeQueryParams, updateLinksWithQueryParams } from "../utils/util"
import { copyToClipboard, addOrUpdateQueryParam, updateBackgroundColor } from '../utils/util.js'
import { colorAllSquares } from '../utils/animationHelper.js'


export function ExpandMenuButton() {
    const { updateGlobalState } = useContext(GlobalStateContext);
    const buttonId = "expand-menu";
    const buttonName = "Settings";
    const extraCssClass = "expand-menu-btn";

    function handleClick(e) {
        updateGlobalState("menuOpen", true);
    }

    return <DoodleButton id={buttonId}
                         extraClassNames={extraCssClass}
                         value={buttonName}
                         onClick={handleClick} />;
}

export function CloseMenuButton() {
    const { updateGlobalState } = useContext(GlobalStateContext);
    const buttonId = "close-menu";
    const buttonName = "X";
    const extraCssClass = "close-menu-btn";

    function handleClick(e) {
        updateGlobalState("menuOpen", false);
    }

    return <DoodleButton id={buttonId}
                         extraClassNames={extraCssClass}
                         value={buttonName}
                         onClick={handleClick} />;
}

function CopyUrlButton() {
    const { globalState } = useContext(GlobalStateContext);
    const buttonId = "copy-url";
    const buttonName = "Copy";

    function handleClick(e) {
        copyToClipboard(window.location.href);
        alert("URL copied!");
    }

    return <DoodleButton id={buttonId}
                         value={buttonName}
                         onClick={handleClick} />;
}

export function DefaultStateButton() {
    const { updateGlobalState } = useContext(GlobalStateContext);
    const buttonId = "default-state";
    const buttonName = "Default";
    const defaultState = getDefaultState();

    function handleClick(e) {
        Object.keys(defaultState).forEach(key => {
            updateGlobalState(key, defaultState[key]);
        });
        updateGlobalState("numSquares", getNewGridNumCells());
        updateBackgroundColor(defaultState);
        removeQueryParams();
        updateLinksWithQueryParams();
    }

    return <DoodleButton id={buttonId}
                         value={buttonName}
                         onClick={handleClick} />;
}

export function RandomSettingsButton() {
    const { updateGlobalState } = useContext(GlobalStateContext);
    const buttonId = "random-state";
    const buttonName = "Random";

    function handleClick(e) {
        function randomizeInputs(selector) {
            const container = document.querySelector(selector);
            const randomizedValues = {};
            const exclude = ['gridBrightness', 'backgroundColor'];
          
            const randomizeInput = (input) => {
              const inputType = input.type.toLowerCase();
              const inputName = input.name || input.id || inputType;
              switch (inputType) {
                case 'checkbox':
                  input.checked = randomizedValues[inputName] = Math.random() < 0.5;
                  break;
                case 'range':
                    const minValue = parseFloat(input.min);
                    const maxValue = parseFloat(input.max);
                    const randomValue = Math.random() * (maxValue - minValue) + minValue;
                    input.value = randomizedValues[inputName] = randomValue.toFixed(2);
                    break;
                case 'select-one':
                  const randomIndex = Math.floor(Math.random() * input.options.length);
                  input.selectedIndex = randomIndex;
                  randomizedValues[inputName] = input.options[randomIndex].value;
                  break;
                case 'color':
                  const randomColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
                  input.value = randomizedValues[inputName] = randomColor;
                  break;
                default:
                  break;
              }
            };
            
            exclude.forEach(key => {
                delete randomizedValues[key];
            });

            const inputs = container.querySelectorAll('input, select');
            inputs.forEach((input) => {
                if (!exclude.includes(input.name)) {
                  randomizeInput(input);
                }
            });
            return randomizedValues;
        }
          
        const randomizedValues = randomizeInputs('.doodle-controls');

        // Open all the menus
        randomizedValues['autoOpen'] = true;
        randomizedValues['clickOpen'] = true;
        randomizedValues['hoverOpen'] = true;
        randomizedValues['colorOpen'] = true;
        randomizedValues['gridOpen'] = true;
        
        Object.keys(randomizedValues).forEach(key => {
            updateGlobalState(key, randomizedValues[key]);
            addOrUpdateQueryParam(key, randomizedValues[key]);
        });

        setTimeout(_ => {
            updateGlobalState("numSquares", getNewGridNumCells());
        }, 100);
    }

    return <DoodleButton id={buttonId}
                         value={buttonName}
                         onClick={handleClick} />;
}

export function ClearBoardButton() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const buttonId = "clear-board";
    const buttonName = "Clear";

    function handleClick(e) {
        const params = {
            'state': globalState,
            'chosenColor': 'red'
        }
        colorAllSquares(params);
    }

    return <DoodleButton id={buttonId}
                         value={buttonName}
                         onClick={handleClick} />;
}

export function DoodleMenuButtonGroupTop() {
    return (
        <div className="doodle-button-group menu-buttons">
            <CopyUrlButton />
            <DefaultStateButton />
            <RandomSettingsButton />
        </div>
    )
}

export function DoodleMenuButtonGroupBottom() {
    return (
        <div className="doodle-button-group footer-buttons">
            <GithubButton />
        </div>
    )
}