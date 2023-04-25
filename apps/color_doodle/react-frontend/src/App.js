import React from "react"
import { createRoot } from "react-dom/client"
import DoodleBoard from "./components/DoodleBoard"
import DoodleMenu from "./components/DoodleMenu"
import { GlobalStateProvider } from "./components/DoodleState"


export default function App() {
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
        <App />,
    </GlobalStateProvider>
);