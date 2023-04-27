import React, { useEffect, useContext } from "react"
import { createRoot } from "react-dom/client"
import DoodleBoard from "./components/DoodleBoard"
import DoodleMenu from "./components/DoodleMenu"
import { GlobalStateProvider, GlobalStateContext } from "./components/DoodleState"
import AutoDoodle from "./utils/autoDoodle"
import { getNewGridNumCells } from "./utils/util"


export default function App() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);

    useEffect(() => {
        // Code here will run only once on page load
        updateGlobalState("numSquares", getNewGridNumCells());
    }, []);

    useEffect(() => {
        // This code runs on every re-render
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