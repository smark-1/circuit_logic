import {
    DISPLAY_MAX_DIGITS,
    DISPLAY_MIN_DIGITS,
    DISPLAY_WIDTH,
} from "./constants.ts";
import { displayBitCount, displayHeightPx, displayInputPinPosition } from "./geometry.ts";
import { createId } from "./utils.ts";
import type {
    DisplayFormat,
    DisplayType,
    NodeID,
    NodesMap,
    NodeType,
} from "./types.ts";

export type DisplayConfig = {
    format: DisplayFormat;
    digits: number;
    bits: number;
    showCarry: boolean;
};

export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
    format: "decimal",
    digits: 3,
    bits: 8,
    showCarry: false,
};

export const DISPLAY_FORMAT_LABELS: Record<DisplayFormat, string> = {
    decimal: "DEC",
    hex: "HEX",
    binary: "BIN",
};

export function displayDigitCount(digits: number): number {
    return Math.round(
        Math.min(Math.max(digits, DISPLAY_MIN_DIGITS), DISPLAY_MAX_DIGITS),
    );
}

export function formatBase(format: DisplayFormat): number {
    switch (format) {
        case "hex":
            return 16;
        case "binary":
            return 2;
        default:
            return 10;
    }
}

/** Largest value the configured digits can represent. */
export function displayMaxValue(format: DisplayFormat, digits: number): number {
    return formatBase(format) ** displayDigitCount(digits) - 1;
}

/**
 * Read the binary value wired into a display. Bit 0 is the first pin.
 * `fallback` lets a saved chip preview read its frozen template pins.
 */
export function displayValue(
    nodes: NodesMap,
    display: DisplayType,
    fallback?: NodesMap,
): number {
    let value = 0;
    display.inputs.forEach((id, bit) => {
        const pin = nodes[id] ?? fallback?.[id];
        if (pin?.value) {
            value += 2 ** bit;
        }
    });
    return value;
}

export function displayOverflows(
    nodes: NodesMap,
    display: DisplayType,
    fallback?: NodesMap,
): boolean {
    return (
        displayValue(nodes, display, fallback) >
        displayMaxValue(display.format, display.digits)
    );
}

export function formatDisplayValue(
    value: number,
    format: DisplayFormat,
): string {
    return value.toString(formatBase(format)).toUpperCase();
}

/** The fixed-width text shown on the LCD. */
export function displayText(
    nodes: NodesMap,
    display: DisplayType,
    fallback?: NodesMap,
): string {
    const raw = formatDisplayValue(
        displayValue(nodes, display, fallback),
        display.format,
    );
    return raw.padStart(displayDigitCount(display.digits), "0");
}

export function displaySize(display: Pick<DisplayType, "inputs">) {
    return {
        width: DISPLAY_WIDTH,
        height: displayHeightPx(display.inputs.length),
    };
}

function makeInputPin(id: NodeID, bit: number, bits: number): NodeType {
    const position = displayInputPinPosition(bit, bits);
    return {
        id,
        type: "input",
        leftPercent: position.leftPercent,
        topPercent: position.topPercent,
        onMainCanvas: false,
        value: false,
    };
}

function makeCarryPin(id: NodeID): NodeType {
    return {
        id,
        type: "output",
        leftPercent: 100,
        topPercent: 50,
        onMainCanvas: false,
        value: false,
    };
}

export function createDisplayNode(
    config: DisplayConfig,
    leftPercent: number,
    topPercent: number,
): { display: DisplayType; pins: NodesMap } {
    const bits = displayBitCount(config.bits);
    const id = createId();
    const inputIds = Array.from({ length: bits }, () => createId());
    const carryId = config.showCarry ? createId() : null;

    const pins: NodesMap = {};
    inputIds.forEach((pinId, bit) => {
        pins[pinId] = makeInputPin(pinId, bit, bits);
    });
    if (carryId) {
        pins[carryId] = makeCarryPin(carryId);
    }

    return {
        display: {
            id,
            type: "display",
            format: config.format,
            digits: displayDigitCount(config.digits),
            showCarry: config.showCarry,
            inputs: inputIds,
            outputs: carryId ? [carryId] : [],
            leftPercent,
            topPercent,
            onMainCanvas: true,
            value: false,
        },
        pins,
    };
}

/**
 * Apply new settings to a display in place, keeping existing pins (and their
 * wires) where possible and dropping only the pins that no longer exist.
 */
export function rebuildDisplay(
    base: NodesMap,
    display: DisplayType,
    config: DisplayConfig,
): { nodes: NodesMap; display: DisplayType; removedConnections: NodeID[] } {
    const bits = displayBitCount(config.bits);
    const next: NodesMap = { ...base };
    const oldInputs = display.inputs;
    const newInputs: NodeID[] = [];

    for (let bit = 0; bit < bits; bit += 1) {
        const candidate = oldInputs[bit];
        if (candidate && base[candidate]?.type === "input") {
            newInputs.push(candidate);
        } else {
            const id = createId();
            next[id] = makeInputPin(id, bit, bits);
            newInputs.push(id);
        }
    }

    const oldCarry = display.outputs[0];
    let carryId: NodeID | null = null;
    if (config.showCarry) {
        if (oldCarry && base[oldCarry]?.type === "output") {
            carryId = oldCarry;
        } else {
            carryId = createId();
            next[carryId] = makeCarryPin(carryId);
        }
    }

    newInputs.forEach((id, bit) => {
        const position = displayInputPinPosition(bit, bits);
        next[id] = {
            ...next[id],
            leftPercent: position.leftPercent,
            topPercent: position.topPercent,
        } as NodeType;
    });
    if (carryId) {
        next[carryId] = {
            ...next[carryId],
            leftPercent: 100,
            topPercent: 50,
        } as NodeType;
    }

    const removedPins = new Set<NodeID>();
    for (const id of oldInputs) {
        if (!newInputs.includes(id)) {
            removedPins.add(id);
        }
    }
    if (oldCarry && oldCarry !== carryId) {
        removedPins.add(oldCarry);
    }
    for (const id of removedPins) {
        delete next[id];
    }

    const removedConnections: NodeID[] = [];
    for (const [id, node] of Object.entries(next)) {
        if (
            node.type === "connection" &&
            (removedPins.has(node.from) || removedPins.has(node.to))
        ) {
            delete next[id];
            removedConnections.push(id);
        }
    }

    const updated: DisplayType = {
        ...display,
        format: config.format,
        digits: displayDigitCount(config.digits),
        showCarry: config.showCarry,
        inputs: newInputs,
        outputs: carryId ? [carryId] : [],
    };
    next[display.id] = updated;

    return { nodes: next, display: updated, removedConnections };
}

/**
 * Bring a display's carry pin up to date after its input pins changed.
 * Returns the carry pin IDs whose value actually changed, so callers can
 * emit their signal.
 */
export function syncDisplayCarry(
    nodes: NodesMap,
    changedIds: Iterable<NodeID>,
): { nodes: NodesMap; carryIds: NodeID[] } {
    const changed = new Set(changedIds);
    let next = nodes;
    const carryIds: NodeID[] = [];

    for (const node of Object.values(nodes)) {
        if (node.type !== "display" || node.outputs.length === 0) {
            continue;
        }
        if (!node.inputs.some((id) => changed.has(id))) {
            continue;
        }

        const value = displayOverflows(next, node);
        for (const outputId of node.outputs) {
            const output = next[outputId];
            if (output && output.value !== value) {
                next = {...next, [outputId]: {...output, value} as NodeType};
                carryIds.push(outputId);
            }
        }
    }

    return { nodes: next, carryIds };
}
