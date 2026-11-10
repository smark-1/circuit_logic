import {createContext} from "react";
import {NodesMap} from "./types.ts";

export const nodeContext = createContext<{
    nodes: NodesMap,
    setNodes: React.Dispatch<React.SetStateAction<NodesMap>>
}>({
    "nodes": {}, setNodes: () => {
    }
});

export const canvasContext = createContext<{ width: number, height: number }>({
    width: 0,
    height: 0,
});
