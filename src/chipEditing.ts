import { settle } from "./runner.ts";
import type {
    BoardMap,
    ChipMap,
    ChipType,
    NodeID,
    NodesMap,
    NodeType,
} from "./types.ts";
import { GetAllIds, createId } from "./utils.ts";

/**
 * A chip editor works on a live copy of the chip's internals. Every node is
 * on the main canvas so the normal board editing gestures apply; saving turns
 * them back into off-canvas template nodes.
 */
export function cloneNodesForEditing(nodes: NodesMap): NodesMap {
    const next: NodesMap = {};
    for (const [id, node] of Object.entries(nodes)) {
        next[id] = {...node, onMainCanvas: true} as NodeType;
    }
    return next;
}

/**
 * Build a saved chip template from edited nodes. Input/output nodes that sit
 * on the editor canvas become the chip's external pins.
 */
export function chipTemplateFromNodes(
    name: string,
    nodes: NodesMap,
    id: NodeID,
    base?: ChipType,
): ChipType {
    const inputs = Object.values(nodes)
        .filter((node) => node.type === "input" && node.onMainCanvas)
        .map((node) => node.id);
    const outputs = Object.values(nodes)
        .filter((node) => node.type === "output" && node.onMainCanvas)
        .map((node) => node.id);

    const normalized: NodesMap = {};
    for (const [nodeId, node] of Object.entries(nodes)) {
        normalized[nodeId] = {...node, onMainCanvas: false} as NodeType;
    }

    if (base) {
        return {...base, id, name, nodes: normalized, inputs, outputs};
    }

    return {
        id,
        type: "chip",
        name,
        nodes: normalized,
        inputs,
        outputs,
        leftPercent: 0,
        topPercent: 0,
        onMainCanvas: false,
        value: false,
    };
}

function cloneNodesWithMap(
    nodes: NodesMap,
    mapId: (id: NodeID) => NodeID,
): NodesMap {
    const next: NodesMap = {};
    for (const [id, node] of Object.entries(nodes)) {
        const newId = mapId(id);
        if (node.type === "connection") {
            next[newId] = {
                ...node,
                id: newId,
                from: mapId(node.from),
                to: mapId(node.to),
            };
        } else if (node.type === "chip") {
            next[newId] = {
                ...node,
                id: newId,
                inputs: node.inputs.map(mapId),
                outputs: node.outputs.map(mapId),
                nodes: cloneNodesWithMap(node.nodes, mapId),
            };
        } else if (node.type === "display") {
            next[newId] = {
                ...node,
                id: newId,
                inputs: node.inputs.map(mapId),
                outputs: node.outputs.map(mapId),
            };
        } else {
            next[newId] = {...node, id: newId};
        }
    }
    return next;
}

/**
 * Rebuild one placed chip from its palette definition. The placed chip keeps
 * its position, its node ID, and as many external pin IDs as the new
 * definition has pins, so wires outside the chip survive.
 */
function rebuildChipInstance(
    instance: ChipType,
    template: ChipType,
): { chip: ChipType; nodes: NodesMap; oldIds: Set<NodeID> } {
    const idMap = new Map<NodeID, NodeID>();

    const inputIds = template.inputs.map((templatePinId, index) => {
        const existing = instance.inputs[index];
        const id = existing ?? createId();
        idMap.set(templatePinId, id);
        return id;
    });
    const outputIds = template.outputs.map((templatePinId, index) => {
        const existing = instance.outputs[index];
        const id = existing ?? createId();
        idMap.set(templatePinId, id);
        return id;
    });

    for (const id of GetAllIds(template.nodes)) {
        if (!idMap.has(id)) {
            idMap.set(id, createId());
        }
    }

    const mapId = (id: NodeID): NodeID => idMap.get(id) ?? id;
    const cloned = cloneNodesWithMap(template.nodes, mapId);

    const oldIds = new Set<NodeID>();
    for (const id of GetAllIds(instance.nodes)) {
        oldIds.add(id);
    }
    for (const id of [...instance.inputs, ...instance.outputs]) {
        oldIds.add(id);
    }

    return {
        chip: {
            ...instance,
            name: template.name,
            inputs: inputIds,
            outputs: outputIds,
            nodes: cloned,
        },
        nodes: cloned,
        oldIds,
    };
}

/**
 * Replace every placed copy of `chipId` in a node map with the new template.
 * Internal nodes are rebuilt, while external pins and outside wiring are
 * preserved where the new definition still has matching pins.
 */
export function updateNodesWithTemplate(
    nodes: NodesMap,
    chipId: NodeID,
    template: ChipType,
): { nodes: NodesMap; changed: boolean } {
    const instances = Object.values(nodes).filter(
        (node): node is ChipType =>
            node.type === "chip" && node.templateId === chipId,
    );
    if (instances.length === 0) {
        return {nodes, changed: false};
    }

    const next: NodesMap = {...nodes};
    const removed = new Set<NodeID>();

    for (const instance of instances) {
        const rebuilt = rebuildChipInstance(instance, template);
        const kept = new Set<NodeID>(Object.keys(rebuilt.nodes));

        for (const id of rebuilt.oldIds) {
            if (!kept.has(id)) {
                removed.add(id);
            }
            delete next[id];
        }
        Object.assign(next, rebuilt.nodes);
        next[instance.id] = rebuilt.chip;
    }

    for (const [id, node] of Object.entries(next)) {
        if (
            node.type === "connection" &&
            (removed.has(node.from) || removed.has(node.to) || !next[node.from] || !next[node.to])
        ) {
            delete next[id];
        }
    }

    return {nodes: settle(next), changed: true};
}

/**
 * Push a saved chip definition into every placed copy and into the other
 * palette chips that contain a copy of it.
 */
export function applyChipTemplate(
    boards: BoardMap,
    chips: ChipMap,
    chipId: NodeID,
    template: ChipType,
): { boards: BoardMap; chips: ChipMap; boardsChanged: boolean } {
    const nextChips: ChipMap = {...chips, [chipId]: template};
    let boardsChanged = false;

    for (const [id, chip] of Object.entries(chips)) {
        if (id === chipId) {
            continue;
        }
        const result = updateNodesWithTemplate(chip.nodes, chipId, template);
        if (result.changed) {
            nextChips[id] = {...chip, nodes: result.nodes};
        }
    }

    const nextBoards: BoardMap = {};
    for (const [id, board] of Object.entries(boards)) {
        const result = updateNodesWithTemplate(board.nodes, chipId, template);
        nextBoards[id] = result.changed
            ? {...board, nodes: result.nodes}
            : board;
        boardsChanged ||= result.changed;
    }

    return {boards: nextBoards, chips: nextChips, boardsChanged};
}
