import React, { useContext } from "react"
import { GlobalStateContext } from "./DoodleState"
import { DoodleButton } from "./DoodleInputs"
import { encodeParams, copyToClipboard } from "../utils/util"


export function CopyUrlButton() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const buttonId = "copy-url";
    const buttonName = "Copy URL";

    function handleClick(e) {
        copyToClipboard(window.location.href);
        alert("URL copied!");
    }

    return <DoodleButton id={buttonId}
                         value={buttonName}
                         onClick={handleClick} />;
}