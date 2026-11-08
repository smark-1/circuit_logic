import {createContext} from "react";
import {NodeID, NodesMap} from "./types.ts";

export const nodeContext = createContext<{
    nodes: NodesMap,
    setNodes: React.Dispatch<React.SetStateAction<NodesMap>>
}>({
    "nodes": {}, setNodes: () => {
    }
});

export const dragContext = createContext<{
    drag: { start: null | NodeID, end: null | NodeID },
    setDrag: React.Dispatch<
        React.SetStateAction<{ start: null | NodeID, end: null | NodeID }>>
}>({
    "drag": {start: null, end: null}, setDrag: () => {
    }
});

export const canvasContext = createContext<{ width: number, height: number }>({
    width: 0,
    height: 0,
});
