import React, { useEffect, useContext } from "react"
import ReactDOM from 'react-dom';
import { createRoot } from "react-dom/client"
import DoodleBoard from "./components/DoodleBoard"
import DoodleMenuContainer from "./components/DoodleMenu"
import { GlobalStateProvider, GlobalStateContext } from "./components/DoodleState"
import AutoDoodle from "./utils/autoDoodle"
import { getNewGridNumCells, updateUrlParams } from "./utils/util"


export default function App() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);

    useEffect(() => {
        // Code here will run only once on page load
        updateGlobalState("numSquares", getNewGridNumCells());
        updateUrlParams(globalState);
    }, []);

    useEffect(() => {
        // This code runs on every re-render
        new AutoDoodle(globalState).run();
    });

    return (
        <>
        <DoodleBoard />

        {ReactDOM.createPortal(
            <DoodleMenuContainer />,
            document.body
        )}
        </>
    )
}

const root = createRoot(document.getElementById("root"));
root.render(
    <GlobalStateProvider>
        <App />
    </GlobalStateProvider>
);