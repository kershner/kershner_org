import React, { useEffect, useContext } from "react"
import { createRoot } from "react-dom/client"
import DoodleBoard from "./components/DoodleBoard"
import DoodleMenu from "./components/DoodleMenu"
import { GlobalStateProvider, GlobalStateContext } from "./components/DoodleState"
import AutoDoodle from "./utils/autoDoodle"


export default function App() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);

    useEffect(() => {
        document.body.style.backgroundColor = globalState.backgroundColor;
        new AutoDoodle(globalState).run();
    });

    return (
        <>
            <DoodleBoard />
            <DoodleMenu />
        </>
    )
}

const root = createRoot(document.getElementById("root"));
root.render(
    <GlobalStateProvider>
        <App />
    </GlobalStateProvider>
);