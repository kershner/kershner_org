import React, { useEffect, useContext } from "react"
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import DoodleBoard from "./components/DoodleBoard.jsx"
import DoodleMenuContainer from "./components/DoodleMenu.jsx"
import { GlobalStateProvider, GlobalStateContext } from "./components/DoodleState.jsx"
import AutoDoodle from "./utils/autoDoodle"
import { updateLinksWithQueryParams, getNewGridNumCells, updateBackgroundColor } from "./utils/util"


export default function App() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);

    useEffect(() => {
        // Code here will run only once on page load
        updateBackgroundColor(globalState);
        updateLinksWithQueryParams();
    }, []);

    useEffect(() => {
        // This code runs on every re-render
        new AutoDoodle(globalState).run();
    });

    return (
        <>
        <DoodleBoard />

        {createPortal(
            <DoodleMenuContainer />,
            document.body
        )}
        </>
    )
}

const root = createRoot(document.getElementById("color-grid"));
root.render(
    <GlobalStateProvider>
        <App />
    </GlobalStateProvider>
);