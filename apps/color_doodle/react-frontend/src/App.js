import React, { useState } from "react"
import ReactDOM from "react-dom";
import DoodleBoard from "./components/DoodleBoard"
import DoodleControls from "./components/DoodleControls"
import DoodleState from "./components/DoodleState"


export default function App() {
    const [state, updateValue] = DoodleState();

    return (
        <>
            <DoodleBoard state={state} updateValue={updateValue} />
            <DoodleControls state={state} updateValue={updateValue} />
        </>
    )
}

ReactDOM.render(<App />, document.getElementById("root"));