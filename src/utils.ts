import {ChipType, DisplayType, NodeID, NodeType, NodesMap} from "./types.ts";
import {DISPLAY_WIDTH, GATE_SIZE} from "./constants.ts";
import {displayHeightPx} from "./geometry.ts";

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

    const displayPercentWidth = canvasWidth > 0 ? DISPLAY_WIDTH / canvasWidth * 100 : 0
    Object.values(nodesList).filter(node => node.type === "display").forEach((display: DisplayType) => {
        const displayPercentHeight = canvasHeight > 0 ? displayHeightPx(display.inputs.length) / canvasHeight * 100 : 0
        for (const pinId of [...display.inputs, ...display.outputs]) {
            const pin = nodesList[pinId]
            if (!pin) continue
            nodesList[pinId] = {
                ...pin,
                leftPercent: display.leftPercent - displayPercentWidth / 2 + pin.leftPercent * displayPercentWidth / 100,
                topPercent: display.topPercent - displayPercentHeight / 2 + pin.topPercent * displayPercentHeight / 100,
            }
        }
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

/**
 * Clone a chip template with fresh IDs.
 *
 * A Map is used instead of replacing ID strings with a regex: IDs are opaque
 * and can contain characters that are special in a regular expression, and a
 * substring match could rewrite an unrelated ID that happens to contain it.
 */
export function remapChip(chip: ChipType): ChipType {
    const idMap = new Map<NodeID, NodeID>()
    for (const id of GetAllIds(chip.nodes)) {
        if (!idMap.has(id)) {
            idMap.set(id, createId())
        }
    }

    const mapId = (id: NodeID): NodeID => idMap.get(id) ?? id

    const remapNodes = (nodes: NodesMap): NodesMap => {
        const next: NodesMap = {}
        for (const [id, node] of Object.entries(nodes)) {
            const newId = mapId(id)
            if (node.type === "connection") {
                next[newId] = {
                    ...node,
                    id: newId,
                    from: mapId(node.from),
                    to: mapId(node.to),
                }
            } else if (node.type === "chip") {
                next[newId] = {
                    ...node,
                    id: newId,
                    inputs: node.inputs.map(mapId),
                    outputs: node.outputs.map(mapId),
                    nodes: remapNodes(node.nodes),
                }
            } else if (node.type === "display") {
                next[newId] = {
                    ...node,
                    id: newId,
                    inputs: node.inputs.map(mapId),
                    outputs: node.outputs.map(mapId),
                }
            } else {
                next[newId] = {...node, id: newId}
            }
        }
        return next
    }

    return {
        ...chip,
        id: mapId(chip.id),
        inputs: chip.inputs.map(mapId),
        outputs: chip.outputs.map(mapId),
        nodes: remapNodes(chip.nodes),
    }
}