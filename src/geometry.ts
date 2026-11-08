import { GATE_SIZE, PIN_HIT_SIZE } from "./constants.ts";
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
