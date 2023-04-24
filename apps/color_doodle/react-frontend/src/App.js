import React from "react"
import { createRoot } from 'react-dom/client';
import DoodleBoard from "./components/DoodleBoard"
import DoodleControls from "./components/DoodleControls"
import { GlobalStateProvider } from "./components/DoodleState"


export default function App() {
    return (
        <>
            <DoodleBoard />
            <DoodleControls />
        </>
    )
}

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
    <GlobalStateProvider>
        <App />,
    </GlobalStateProvider>
);