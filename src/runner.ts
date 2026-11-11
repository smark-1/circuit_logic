import type { ConnectionType, NodeID, NodeType, NodesMap } from "./types.ts";
import { GetAllIds, createId } from "./utils.ts";
import { syncDisplayCarry } from "./display.ts";

const MIN_PROPAGATION_STEPS = 100;
const STEPS_PER_NODE = 8;

function isConnection(node: NodeType): node is ConnectionType {
    return node.type === "connection";
}

/**
 * The value a node sends down its outgoing connections.
 * Only NOT inverts its input; every other source passes its value through.
 */
export function outputValue(node: NodeType): boolean {
    return node.type === "not" ? !node.value : node.value;
}

/**
 * Re-evaluate the circuit synchronously, starting from the given node IDs.
 *
 * This replaces the old timeout queue: every step reads the current node
 * state instead of a snapshot, so toggling several inputs quickly can never
 * apply a stale value later on. The step limit stops feedback loops from
 * oscillating forever.
 */
export function propagate(nodes: NodesMap, startIds: NodeID[]): NodesMap {
    let next: NodesMap = {...nodes};
    const queue: NodeID[] = [...startIds];
    const maxSteps = Math.max(
        MIN_PROPAGATION_STEPS,
        Object.keys(nodes).length * STEPS_PER_NODE,
    );

    let steps = 0;
    while (queue.length > 0 && steps < maxSteps) {
        steps += 1;
        const id = queue.shift();
        if (id === undefined) {
            break;
        }

        // A display input pin changing also refreshes that display's carry pin.
        const synced = syncDisplayCarry(next, [id]);
        if (synced.nodes !== next) {
            next = synced.nodes;
            queue.push(...synced.carryIds);
        }

        const node = next[id];
        if (!node) {
            continue;
        }

        if (isConnection(node)) {
            const target = next[node.to];
            if (!target) {
                continue;
            }

            // Multiple connections into one node behave as an OR.
            let value = false;
            for (const candidate of Object.values(next)) {
                if (candidate.type === "connection" && candidate.to === node.to && candidate.value) {
                    value = true;
                    break;
                }
            }

            if (target.value !== value) {
                next[target.id] = {...target, value} as NodeType;
                queue.push(target.id);
            }
            continue;
        }

        const value = outputValue(node);
        for (const candidate of Object.values(next)) {
            if (candidate.type !== "connection" || candidate.from !== node.id) {
                continue;
            }
            if (candidate.value === value) {
                continue;
            }
            next[candidate.id] = {...candidate, value};
            queue.push(candidate.id);
        }
    }

    return next;
}

/**
 * Bring every node in the map to a consistent state. Useful after loading a
 * chip template whose stored values may be stale.
 */
export function settle(nodes: NodesMap): NodesMap {
    return propagate(nodes, Object.keys(nodes));
}

function canBeSource(node: NodeType): boolean {
    if (node.type === "not") {
        return true;
    }
    if (node.type === "input") {
        return node.onMainCanvas;
    }
    return node.type === "output" && !node.onMainCanvas;
}

function canBeSink(node: NodeType): boolean {
    if (node.type === "not") {
        return true;
    }
    if (node.type === "output") {
        return node.onMainCanvas;
    }
    return node.type === "input" && !node.onMainCanvas;
}

/**
 * Add a connection without moving any signal. The caller is responsible for
 * scheduling the first pulse from the source (see `simulation.ts`).
 *
 * Returns the original map when the connection would be a duplicate or is
 * invalid (for example an output feeding another output).
 */
export function createConnection(nodes: NodesMap, from: NodeID, to: NodeID): NodesMap {
    const source = nodes[from];
    const sink = nodes[to];

    if (!source || !sink) {
        return nodes;
    }
    // A NOT gate is both a source and a sink, so feeding it back into itself
    // is how a clock/oscillator is built.
    if (from === to && source.type !== "not") {
        return nodes;
    }
    if (!canBeSource(source) || !canBeSink(sink)) {
        return nodes;
    }

    for (const node of Object.values(nodes)) {
        if (node.type === "connection" && node.from === from && node.to === to) {
            return nodes;
        }
    }

    const id = createId();
    const connection: ConnectionType = {
        id,
        type: "connection",
        from,
        to,
        leftPercent: 0,
        topPercent: 0,
        value: false,
        onMainCanvas: true,
    };

    return {...nodes, [id]: connection};
}

function settleTargets(nodes: NodesMap, targetIds: Iterable<NodeID>): NodesMap {
    let next = nodes;

    for (const targetId of targetIds) {
        const target = next[targetId];
        if (!target) {
            continue;
        }

        let value = false;
        for (const node of Object.values(next)) {
            if (node.type === "connection" && node.to === targetId && node.value) {
                value = true;
                break;
            }
        }

        if (target.value !== value) {
            next = {...next, [targetId]: {...target, value} as NodeType};
            next = propagate(next, [targetId]);
        }
    }

    return next;
}

/**
 * Remove a node (including a chip's flattened internal nodes) and every
 * connection touching it. Targets that lost an input are re-evaluated, so
 * removing one of several true inputs correctly updates the output.
 */
export function deleteNode(nodes: NodesMap, id: NodeID): NodesMap {
    const node = nodes[id];
    if (!node) {
        return nodes;
    }

    const removed = new Set<NodeID>([id]);
    if (node.type === "connection") {
        // Removing a wire changes its target's input, even though the target
        // itself is not being removed.
        const next: NodesMap = {};
        for (const [candidateId, candidate] of Object.entries(nodes)) {
            if (candidateId !== id) {
                next[candidateId] = candidate;
            }
        }
        return settleTargets(next, [node.to]);
    }
    if (node.type === "chip") {
        for (const internalId of GetAllIds(node.nodes)) {
            removed.add(internalId);
        }
        for (const ioId of [...node.inputs, ...node.outputs]) {
            removed.add(ioId);
        }
    }
    if (node.type === "display") {
        for (const ioId of [
            ...node.inputs,
            ...(node.signInput ? [node.signInput] : []),
            ...node.outputs,
        ]) {
            removed.add(ioId);
        }
    }

    const affectedTargets = new Set<NodeID>();
    const next: NodesMap = {};

    for (const [candidateId, candidate] of Object.entries(nodes)) {
        if (removed.has(candidateId)) {
            continue;
        }

        if (candidate.type === "connection") {
            if (removed.has(candidate.from) || removed.has(candidate.to)) {
                if (!removed.has(candidate.to)) {
                    affectedTargets.add(candidate.to);
                }
                continue;
            }
        }

        next[candidateId] = candidate;
    }

    return settleTargets(next, affectedTargets);
}
