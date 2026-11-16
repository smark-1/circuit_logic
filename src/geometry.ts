import {
    CHIP_PIN_GAP,
    CHIP_PIN_MARGIN,
    DISPLAY_MAX_BITS,
    DISPLAY_MAX_PIN_ROWS,
    DISPLAY_MIN_BITS,
    DISPLAY_PIN_COLUMN_GAP,
    DISPLAY_PIN_GAP,
    DISPLAY_PIN_MARGIN,
    DISPLAY_MIN_HEIGHT,
    DISPLAY_SCREEN_GAP,
    DISPLAY_WIDTH,
    GATE_SIZE,
    MAX_CONNECTION_DELAY_MS,
    MIN_CONNECTION_DELAY_MS,
    PIN_HIT_SIZE,
} from "./constants.ts";
import type { ChipType, NodeType } from "./types.ts";

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

/**
 * Number of pins used to lay out a display. This includes the optional sign
 * pin, so it can be one larger than the maximum data bit count.
 */
function displayLayoutPinCount(pins: number): number {
    return Math.round(clamp(pins, DISPLAY_MIN_BITS, DISPLAY_MAX_BITS + 1));
}

function displayColumns(pins: number): number {
    return Math.ceil(displayLayoutPinCount(pins) / DISPLAY_MAX_PIN_ROWS);
}

export function displayRows(pins: number): number {
    return Math.ceil(displayLayoutPinCount(pins) / displayColumns(pins));
}

/**
 * Width in pixels of a display with the given number of input pins. Pins are
 * arranged in aligned columns on the left, and the display widens for every
 * extra column so the pins never sit outside the body.
 */
export function displayWidthPx(pins: number): number {
    const columns = displayColumns(pins);
    return (
        DISPLAY_WIDTH +
        DISPLAY_PIN_MARGIN * 2 +
        DISPLAY_SCREEN_GAP +
        (columns - 1) * DISPLAY_PIN_COLUMN_GAP
    );
}

/** Height in pixels of a display with the given number of input pins. */
export function displayHeightPx(pins: number): number {
    const rows = displayRows(pins);
    return Math.max(
        DISPLAY_MIN_HEIGHT,
        (rows - 1) * DISPLAY_PIN_GAP + DISPLAY_PIN_MARGIN * 2,
    );
}

/** Local x offset, in pixels, of the display's screen inside the body. */
export function displayScreenOffsetPx(pins: number): number {
    return displayWidthPx(pins) - DISPLAY_WIDTH;
}

/**
 * Where an input pin sits inside its display, as percentages of the display
 * box. Slot 0 is the bottom pin of the first column and higher slots fill the
 * column upwards; extra columns sit to the right in a straight, aligned grid.
 */
export function displayInputPinPosition(slot: number, pins: number): { leftPercent: number; topPercent: number } {
    const count = displayLayoutPinCount(pins);
    const rows = displayRows(count);
    const width = displayWidthPx(count);
    const height = displayHeightPx(count);
    const column = Math.floor(slot / rows);
    const row = slot % rows;
    const spanY = (rows - 1) * DISPLAY_PIN_GAP;
    const startY = (height - spanY) / 2;
    return {
        leftPercent: ((DISPLAY_PIN_MARGIN + column * DISPLAY_PIN_COLUMN_GAP) / width) * 100,
        topPercent: ((startY + (rows - 1 - row) * DISPLAY_PIN_GAP) / height) * 100,
    };
}

/** Number of external pins on the busier side of a custom chip. */
export function chipPinCount(inputs: number, outputs: number): number {
    return Math.max(1, Math.round(Math.max(inputs, outputs)));
}

/**
 * Height in pixels of a custom chip face. Pins are spread with a fixed gap,
 * so the chip grows taller instead of letting neighbouring pins overlap.
 */
export function chipHeightForCounts(inputs: number, outputs: number): number {
    const pins = chipPinCount(inputs, outputs);
    return Math.max(
        GATE_SIZE,
        (pins - 1) * CHIP_PIN_GAP + CHIP_PIN_MARGIN * 2,
    );
}

/** Size in pixels of a custom chip face. */
export function chipSize(chip: Pick<ChipType, "inputs" | "outputs">): { width: number; height: number } {
    return {
        width: GATE_SIZE,
        height: chipHeightForCounts(chip.inputs.length, chip.outputs.length),
    };
}

/**
 * Vertical position of an external chip pin as a percentage of the chip
 * face. Pins are centered and spaced by their index, with a fixed pixel gap.
 */
export function chipPinTopPercent(
    index: number,
    count: number,
    heightPx: number,
): number {
    if (count <= 1) {
        return 50;
    }
    const span = (count - 1) * CHIP_PIN_GAP;
    const start = (heightPx - span) / 2;
    return ((start + index * CHIP_PIN_GAP) / heightPx) * 100;
}
