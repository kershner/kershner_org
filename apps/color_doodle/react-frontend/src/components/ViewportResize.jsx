import { useState, useEffect, useContext } from "react"
import { GlobalStateContext } from "./DoodleState.jsx"
import { getNewGridNumCells } from "../utils/util"


export default function ViewportResize(props) {
    const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);

    useEffect(() => {
        function handleResize() {
            updateGlobalState("numSquares", getNewGridNumCells());
        }

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);
}