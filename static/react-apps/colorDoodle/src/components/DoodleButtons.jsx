import React, { useContext } from "react"
import { GlobalStateContext, defaultState } from "./DoodleState.jsx"
import { DoodleButton, GithubButton } from "./DoodleInputs.jsx"
import { encodeParams, copyToClipboard, updateUrlParams, getNewGridNumCells } from "../utils/util"


export function ExpandMenuButton() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const buttonId = "expand-menu";
    const buttonName = "Settings";
    const extraCssClass = "expand-menu-btn";

    function handleClick(e) {
        updateGlobalState("menuOpen", true, (newState)=> {
            updateUrlParams(newState);
        });
    }

    return <DoodleButton id={buttonId}
                         extraClassNames={extraCssClass}
                         value={buttonName}
                         onClick={handleClick} />;
}

export function CloseMenuButton() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const buttonId = "close-menu";
    const buttonName = "Close";
    const extraCssClass = "close-menu-btn";

    function handleClick(e) {
        updateGlobalState("menuOpen", false, (newState)=> {
            updateUrlParams(newState);
        });
    }

    return <DoodleButton id={buttonId}
                         extraClassNames={extraCssClass}
                         value={buttonName}
                         onClick={handleClick} />;
}

function CopyUrlButton() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const buttonId = "copy-url";
    const buttonName = "Copy";

    function handleClick(e) {
        updateUrlParams(globalState);
        copyToClipboard(window.location.href);
        alert("URL copied!");
    }

    return <DoodleButton id={buttonId}
                         value={buttonName}
                         onClick={handleClick} />;
}

export function DefaultStateButton() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const buttonId = "default-state";
    const buttonName = "Default";

    function handleClick(e) {
        Object.keys(defaultState).forEach(key => {
            updateGlobalState(key, defaultState[key]);
        });

        updateGlobalState("numSquares", getNewGridNumCells(), (newState)=> {
            updateUrlParams(newState);
        });
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
            <CloseMenuButton />
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