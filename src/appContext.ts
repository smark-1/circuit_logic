import {createContext} from "react";
import {NodeID, NodeType} from "./types.ts";

export const nodeContext = createContext<{
    nodes: { [key: string]: NodeType },
    setNodes: React.Dispatch<
        React.SetStateAction<{ [p: string]: NodeType }>>
}>
({
    "nodes": {}, setNodes: () => {
    }
});

export const dragContext = createContext<{
    drag: { start: null | NodeID, end: null | NodeID },
    setDrag: React.Dispatch<
        React.SetStateAction<{ start: null | NodeID, end: null | NodeID }>>
}>
({
    "drag": {start: null, end: null}, setDrag: () => {
    }
});