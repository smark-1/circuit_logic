import { OFF_CANVAS_CONNECTION_DELAY_MS } from "./constants.ts";
import { connectionDurationMs } from "./geometry.ts";
import { outputValue } from "./runner.ts";
import type { ConnectionType, NodeID, NodesMap, NodeType } from "./types.ts";
import { getNodes } from "./utils.ts";

type SimulationOptions = {
    /** The latest nodes map, synchronously maintained by the caller. */
    getNodes: () => NodesMap;
    applyNodes: (nodes: NodesMap) => void;
    getCanvasSize: () => { width: number; height: number };
};

export type Simulation = {
    /** Start a pulse for every outgoing connection of a node. */
    emitFrom: (nodes: NodesMap, nodeId: NodeID) => void;
    /** Start the first pulse for a newly created connection. */
    startConnection: (nodes: NodesMap, connectionId: NodeID) => void;
    /** Treat the given connections' current values as already delivered. */
    primeConnections: (nodes: NodesMap) => void;
    /** Treat every current connection value as already delivered. */
    primeArrivals: (nodes: NodesMap) => void;
    /** Drop timers and arrival state for connections that no longer exist. */
    forgetConnections: (connectionIds: Iterable<NodeID>) => void;
    /** Drop all pending signals. */
    clear: () => void;
};

function arrivedInput(nodes: NodesMap, arrivals: Map<NodeID, boolean>, targetId: NodeID): boolean {
    for (const node of Object.values(nodes)) {
        if (
            node.type === "connection" &&
            node.to === targetId &&
            arrivals.get(node.id) === true
        ) {
            return true;
        }
    }
    return false;
}

/**
 * A small event-driven signal simulator.
 *
 * `connection.value` is the value currently travelling on the wire, so the
 * connection animation starts at the source immediately. The destination is
 * only updated when that pulse arrives, after the same duration the
 * animation uses. This keeps the picture and the state in sync, and gives
 * feedback loops a real delay instead of resolving instantly.
 */
export function createSimulation(options: SimulationOptions): Simulation {
    const arrivals = new Map<NodeID, boolean>();
    const timers = new Map<NodeID, ReturnType<typeof setTimeout>>();

    const scheduleArrival = (connection: ConnectionType, value: boolean) => {
        const existing = timers.get(connection.id);
        if (existing !== undefined) {
            clearTimeout(existing);
        }

        let delay = OFF_CANVAS_CONNECTION_DELAY_MS;
        if (connection.onMainCanvas) {
            const nodes = options.getNodes();
            const size = options.getCanvasSize();
            const laidOut = getNodes(nodes, size.width, size.height);
            const fromNode = laidOut[connection.from];
            const toNode = laidOut[connection.to];
            if (fromNode && toNode) {
                delay = connectionDurationMs(fromNode, toNode, size.width, size.height);
            }
        }

        const timer = setTimeout(() => {
            timers.delete(connection.id);

            const current = options.getNodes();
            const target = current[connection.to];
            if (!target) {
                return;
            }

            arrivals.set(connection.id, value);
            const valueAtTarget = arrivedInput(current, arrivals, connection.to);
            if (target.value === valueAtTarget) {
                return;
            }

            const next = {
                ...current,
                [connection.to]: {...target, value: valueAtTarget} as NodeType,
            };
            options.applyNodes(next);
            emitFrom(next, connection.to);
        }, delay);

        timers.set(connection.id, timer);
    };

    const emitFrom = (nodes: NodesMap, nodeId: NodeID) => {
        const source = nodes[nodeId];
        if (!source) {
            return;
        }

        const value = outputValue(source);
        const outgoing: ConnectionType[] = [];
        let next = nodes;

        for (const node of Object.values(nodes)) {
            if (node.type !== "connection" || node.from !== nodeId) {
                continue;
            }
            if (node.value === value) {
                continue;
            }

            const connection = {...node, value};
            next = {...next, [connection.id]: connection};
            outgoing.push(connection);
        }

        if (next !== nodes) {
            options.applyNodes(next);
        }
        for (const connection of outgoing) {
            scheduleArrival(connection, value);
        }
    };

    return {
        emitFrom,
        startConnection(nodes, connectionId) {
            const connection = nodes[connectionId];
            if (!connection || connection.type !== "connection") {
                return;
            }
            const source = nodes[connection.from];
            if (!source) {
                return;
            }

            const value = outputValue(source);
            const next =
                connection.value === value
                    ? nodes
                    : {...nodes, [connection.id]: {...connection, value}};
            if (next !== nodes) {
                options.applyNodes(next);
            }
            scheduleArrival({...connection, value}, value);
        },
        primeConnections(nodes) {
            for (const node of Object.values(nodes)) {
                if (node.type === "connection") {
                    arrivals.set(node.id, node.value);
                }
            }
        },
        primeArrivals(nodes) {
            const connectionIds = new Set<NodeID>();
            for (const node of Object.values(nodes)) {
                if (node.type === "connection") {
                    connectionIds.add(node.id);
                    arrivals.set(node.id, node.value);
                }
            }
            for (const id of [...arrivals.keys()]) {
                if (!connectionIds.has(id)) {
                    arrivals.delete(id);
                }
            }
        },
        forgetConnections(connectionIds) {
            for (const id of connectionIds) {
                const timer = timers.get(id);
                if (timer !== undefined) {
                    clearTimeout(timer);
                    timers.delete(id);
                }
                arrivals.delete(id);
            }
        },
        clear() {
            for (const timer of timers.values()) {
                clearTimeout(timer);
            }
            timers.clear();
            arrivals.clear();
        },
    };
}
