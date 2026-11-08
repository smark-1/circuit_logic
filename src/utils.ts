import {ChipType, NodeID, NodeType, NodesMap} from "./types.ts";
import {GATE_SIZE} from "./constants.ts";

export function createId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return Math.random().toString();
}

export function getNodes(nodes: NodesMap, canvasWidth: number, canvasHeight: number): NodesMap {
    const nodesList: NodesMap = {...nodes}

    const chipPercentWidth = canvasWidth > 0 ? GATE_SIZE / canvasWidth * 100 : 0
    const chipPercentHeight = canvasHeight > 0 ? GATE_SIZE / canvasHeight * 100 : 0

    Object.values(nodesList).filter(node => node.type === "chip").forEach((node: ChipType) => {
        Object.values(node.nodes).filter(node => ['input', 'output'].includes(node.type))
            .forEach((IOnode: NodeType) => {
                nodesList[IOnode.id] = {
                    ...(nodesList[IOnode.id] ?? IOnode),
                    leftPercent: IOnode.type === "input" ? node.leftPercent - chipPercentWidth / 2 : node.leftPercent + chipPercentWidth / 2,
                    topPercent: node.topPercent - chipPercentHeight / 2 + IOnode.topPercent * chipPercentHeight / 100
                }
            })
    })
    return nodesList
}


export function GetAllIds(nodes: { [key: string]: NodeType }): NodeID[] {
    let ids: NodeID[] = []
    for (const id in nodes) {
        ids.push(id)
        if (nodes[id].type === "chip") {
            ids.push(...GetAllIds(nodes[id].nodes))
        }
    }
    return ids
}