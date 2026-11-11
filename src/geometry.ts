import {
    DISPLAY_MAX_BITS,
    DISPLAY_MAX_PIN_ROWS,
    DISPLAY_MIN_BITS,
    DISPLAY_PIN_COLUMN_LEFT,
    DISPLAY_PIN_GAP,
    DISPLAY_MIN_HEIGHT,
    GATE_SIZE,
    MAX_CONNECTION_DELAY_MS,
    MIN_CONNECTION_DELAY_MS,
    PIN_HIT_SIZE,
} from "./constants.ts";
import type { NodeType } from "./types.ts";

export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Clamp a pixel position so an element of `sizePx` stays fully inside a
 * container, then convert it to a percentage.
 */
export function clampPercentFromPx(valuePx: number, sizePx: number, totalPx: number): number {
    if (totalPx <= 0) {
        return 50;
    }
    if (totalPx <= sizePx) {
        return 50;
    }
    const half = sizePx / 2;
    return (clamp(valuePx, half, totalPx - half) / totalPx) * 100;
}

/**
 * Horizontal connection anchor for a node, expressed as a percentage.
 *
 * Main input/output nodes are aligned inside the canvas edge rather than
 * centered on it, so their anchor is half a pin hit box in from the edge.
 * NOT nodes are centered, so their anchor is half a gate in from the center.
 * Chip pins already carry an absolute position from `getNodes`.
 */
export function nodeAnchorX(node: NodeType, side: "from" | "to", canvasWidth: number): number {
    if (canvasWidth <= 0) {
        return node.leftPercent;
    }

    const pinOffset = ((PIN_HIT_SIZE / 2) / canvasWidth) * 100;
    const gateOffset = ((GATE_SIZE / 2) / canvasWidth) * 100;

    if (node.onMainCanvas && node.type === "input") {
        return pinOffset;
    }
    if (node.onMainCanvas && node.type === "output") {
        return 100 - pinOffset;
    }
    if (node.type === "not") {
        return node.leftPercent + (side === "from" ? gateOffset : -gateOffset);
    }
    return node.leftPercent;
}

/**
 * How long a signal takes to travel between two laid-out nodes, in
 * milliseconds. The connection animation uses exactly this duration, so the
 * visual pulse reaches the destination when the destination value changes.
 */
export function connectionDurationMs(
    fromNode: NodeType,
    toNode: NodeType,
    canvasWidth: number,
    canvasHeight: number,
): number {
    if (canvasWidth <= 0 || canvasHeight <= 0) {
        return MIN_CONNECTION_DELAY_MS;
    }

    const fromX = (nodeAnchorX(fromNode, "from", canvasWidth) / 100) * canvasWidth;
    const toX = (nodeAnchorX(toNode, "to", canvasWidth) / 100) * canvasWidth;
    const fromY = (fromNode.topPercent / 100) * canvasHeight;
    const toY = (toNode.topPercent / 100) * canvasHeight;
    const length = Math.hypot(toX - fromX, toY - fromY);

    return clamp(length, MIN_CONNECTION_DELAY_MS, MAX_CONNECTION_DELAY_MS);
}

export function displayBitCount(bits: number): number {
    return Math.round(clamp(bits, DISPLAY_MIN_BITS, DISPLAY_MAX_BITS));
}

function displayColumns(bits: number): number {
    return Math.ceil(displayBitCount(bits) / DISPLAY_MAX_PIN_ROWS);
}

export function displayRows(bits: number): number {
    return Math.ceil(displayBitCount(bits) / displayColumns(bits));
}

/** Height in pixels of a display with the given number of input pins. */
export function displayHeightPx(bits: number): number {
    return Math.max(DISPLAY_MIN_HEIGHT, displayRows(bits) * DISPLAY_PIN_GAP + 56);
}

/**
 * Where an input pin sits inside its display, as percentages of the display
 * box. Slot 0 is the bottom pin of the first column, and higher columns sit
 * just outside the left edge so a wide bus stays compact.
 */
export function displayInputPinPosition(slot: number, bits: number): { leftPercent: number; topPercent: number } {
    const rows = displayRows(bits);
    const column = Math.floor(slot / rows);
    const row = slot % rows;
    return {
        leftPercent: column * DISPLAY_PIN_COLUMN_LEFT,
        topPercent: ((rows - row) / (rows + 1)) * 100,
    };
}
