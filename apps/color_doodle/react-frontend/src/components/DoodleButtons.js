import React, { useContext } from "react"
import { GlobalStateContext } from "./DoodleState"
import { DoodleButton } from "./DoodleInputs"
import { encodeParams, copyToClipboard, updateUrlParams } from "../utils/util"


export function CopyUrlButton() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const buttonId = "copy-url";
    const buttonName = "Copy URL";

    function handleClick(e) {
        updateUrlParams(globalState);
        copyToClipboard(window.location.href);
        alert("URL copied!");
    }

    return <DoodleButton id={buttonId}
                         value={buttonName}
                         onClick={handleClick} />;
}

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