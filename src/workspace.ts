import { DISPLAY_MAX_DIGITS, DISPLAY_MIN_DIGITS } from "./constants.ts";
import { settle } from "./runner.ts";
import { createId } from "./utils.ts";
import type {
    BoardMap,
    BoardType,
    ChipMap,
    ChipType,
    DisplayFormat,
    NodeID,
    NodesMap,
} from "./types.ts";

export type BoardTab = {
    kind: "board";
    id: NodeID;
};

export type ChipTab = {
    kind: "chip";
    chipId: NodeID;
    draft: NodesMap;
    dirty: boolean;
};

export type TabType = BoardTab | ChipTab;

export type Workspace = {
    boards: BoardMap;
    chips: ChipMap;
    tabs: TabType[];
    activeIndex: number;
};

export function tabNodes(workspace: Workspace, tab: TabType): NodesMap {
    if (tab.kind === "board") {
        return workspace.boards[tab.id]?.nodes ?? {};
    }
    return tab.draft;
}

export function activeNodes(workspace: Workspace): NodesMap {
    const tab = workspace.tabs[workspace.activeIndex];
    return tab ? tabNodes(workspace, tab) : {};
}

export function tabTitle(workspace: Workspace, tab: TabType): string {
    if (tab.kind === "board") {
        return workspace.boards[tab.id]?.name ?? "Board";
    }
    return workspace.chips[tab.chipId]?.name ?? "Chip";
}

export function createInitialWorkspace(chips: ChipMap): Workspace {
    const id = createId();
    return {
        boards: {
            [id]: {
                id,
                name: "Board 1",
                nodes: {},
            },
        },
        chips: Object.fromEntries(
            Object.entries(chips).map(([chipId, chip]) => [
                chipId,
                {...chip, builtIn: true},
            ]),
        ),
        tabs: [{kind: "board", id}],
        activeIndex: 0,
    };
}

/** The next free number for a new "Board N" tab. */
export function nextBoardNumber(workspace: Workspace): number {
    let highest = 0;
    for (const board of Object.values(workspace.boards)) {
        const match = /^Board (\d+)$/.exec(board.name);
        if (match) {
            highest = Math.max(highest, Number(match[1]));
        }
    }
    return Math.max(1, highest);
}

export const WORKSPACE_STORAGE_KEY = "circuit-logic.workspace.v1";
const WORKSPACE_STORAGE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown, fallback = 0): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): NodeID[] | null {
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
        return null;
    }
    return [...value];
}

function asDisplayFormat(value: unknown): DisplayFormat {
    if (value === "hex" || value === "binary") {
        return value;
    }
    return "decimal";
}

/**
 * Rebuild a node map from untrusted local storage data. Invalid nodes are
 * dropped, as are connections whose endpoints are gone and display/chip pins
 * that no longer point at a node of the right kind.
 */
function sanitizeNodeMap(raw: unknown): NodesMap {
    const nodes: NodesMap = {};
    if (!isRecord(raw)) {
        return nodes;
    }

    for (const [key, value] of Object.entries(raw)) {
        if (!isRecord(value)) continue;
        const type = value.type;
        if (
            type !== "input" &&
            type !== "output" &&
            type !== "connection" &&
            type !== "chip" &&
            type !== "not" &&
            type !== "display"
        ) {
            continue;
        }

        const id = typeof value.id === "string" && value.id ? value.id : key;
        const common = {
            id,
            leftPercent: asNumber(value.leftPercent),
            topPercent: asNumber(value.topPercent),
            onMainCanvas: asBoolean(value.onMainCanvas),
            value: asBoolean(value.value),
        };

        switch (type) {
            case "input":
                nodes[id] = {...common, type, id};
                break;
            case "output":
                nodes[id] = {...common, type, id};
                break;
            case "not":
                nodes[id] = {...common, type, id};
                break;
            case "connection": {
                if (typeof value.from !== "string" || typeof value.to !== "string") {
                    break;
                }
                nodes[id] = {
                    ...common,
                    type,
                    id,
                    from: value.from,
                    to: value.to,
                };
                break;
            }
            case "chip": {
                const chipNodes = sanitizeNodeMap(value.nodes);
                const inputs = (asStringArray(value.inputs) ?? []).filter(
                    (pinId) => chipNodes[pinId]?.type === "input",
                );
                const outputs = (asStringArray(value.outputs) ?? []).filter(
                    (pinId) => chipNodes[pinId]?.type === "output",
                );
                const chip: ChipType = {
                    ...common,
                    type,
                    id,
                    name:
                        typeof value.name === "string" && value.name.trim()
                            ? value.name
                            : "Chip",
                    inputs,
                    outputs,
                    nodes: chipNodes,
                };
                if (typeof value.templateId === "string") {
                    chip.templateId = value.templateId;
                }
                if (value.builtIn === true) {
                    chip.builtIn = true;
                }
                nodes[id] = chip;
                break;
            }
            case "display": {
                const digits = Math.round(asNumber(value.digits, 3));
                nodes[id] = {
                    ...common,
                    type,
                    id,
                    format: asDisplayFormat(value.format),
                    digits: Math.max(
                        DISPLAY_MIN_DIGITS,
                        Math.min(DISPLAY_MAX_DIGITS, digits),
                    ),
                    showCarry: asBoolean(value.showCarry),
                    showSign: asBoolean(value.showSign),
                    inputs: asStringArray(value.inputs) ?? [],
                    signInput:
                        typeof value.signInput === "string"
                            ? value.signInput
                            : null,
                    outputs: asStringArray(value.outputs) ?? [],
                };
                break;
            }
        }
    }

    for (const [id, node] of Object.entries(nodes)) {
        if (node.type === "connection" && (!nodes[node.from] || !nodes[node.to])) {
            delete nodes[id];
        }
    }

    for (const node of Object.values(nodes)) {
        if (node.type !== "display") continue;
        node.inputs = node.inputs.filter(
            (pinId) => nodes[pinId]?.type === "input",
        );
        node.outputs = node.outputs.filter(
            (pinId) => nodes[pinId]?.type === "output",
        );
        if (node.signInput && nodes[node.signInput]?.type !== "input") {
            node.signInput = null;
        }
    }

    return nodes;
}

function sanitizeBoard(key: string, raw: unknown): BoardType | null {
    if (!isRecord(raw)) return null;
    const id = typeof raw.id === "string" && raw.id ? raw.id : key;
    return {
        id,
        name:
            typeof raw.name === "string" && raw.name.trim()
                ? raw.name
                : "Board",
        nodes: settle(sanitizeNodeMap(raw.nodes)),
    };
}

function sanitizeUserChip(key: string, raw: unknown): ChipType | null {
    if (!isRecord(raw) || raw.builtIn === true) return null;
    const id = typeof raw.id === "string" && raw.id ? raw.id : key;
    const nodes = sanitizeNodeMap(raw.nodes);
    return {
        id,
        type: "chip",
        name:
            typeof raw.name === "string" && raw.name.trim()
                ? raw.name
                : "Chip",
        inputs: (asStringArray(raw.inputs) ?? []).filter(
            (pinId) => nodes[pinId]?.type === "input",
        ),
        outputs: (asStringArray(raw.outputs) ?? []).filter(
            (pinId) => nodes[pinId]?.type === "output",
        ),
        nodes,
        leftPercent: asNumber(raw.leftPercent),
        topPercent: asNumber(raw.topPercent),
        onMainCanvas: false,
        value: false,
    };
}

function sanitizeTab(
    raw: unknown,
    boards: BoardMap,
    chips: ChipMap,
): TabType | null {
    if (!isRecord(raw)) return null;
    if (raw.kind === "board") {
        return typeof raw.id === "string" && boards[raw.id]
            ? {kind: "board", id: raw.id}
            : null;
    }
    if (raw.kind === "chip" && typeof raw.chipId === "string") {
        const chip = chips[raw.chipId];
        if (!chip || chip.builtIn) return null;
        return {
            kind: "chip",
            chipId: raw.chipId,
            draft: settle(sanitizeNodeMap(raw.draft)),
            dirty: raw.dirty === true,
        };
    }
    return null;
}

function sanitizeWorkspace(raw: unknown, defaultChips: ChipMap): Workspace | null {
    if (!isRecord(raw)) return null;

    const boards: BoardMap = {};
    if (isRecord(raw.boards)) {
        for (const [key, value] of Object.entries(raw.boards)) {
            const board = sanitizeBoard(key, value);
            if (board) boards[board.id] = board;
        }
    }

    const chips: ChipMap = {};
    if (isRecord(raw.chips)) {
        for (const [key, value] of Object.entries(raw.chips)) {
            const chip = sanitizeUserChip(key, value);
            if (chip) chips[chip.id] = chip;
        }
    }

    // Built-ins always come from code so app updates are picked up, while
    // user-made chips and their copies come from storage.
    for (const [id, chip] of Object.entries(defaultChips)) {
        chips[id] = {...chip, builtIn: true};
    }

    if (Object.keys(boards).length === 0) {
        const id = createId();
        boards[id] = {id, name: "Board 1", nodes: {}};
    }

    const tabs: TabType[] = [];
    if (Array.isArray(raw.tabs)) {
        for (const value of raw.tabs) {
            const tab = sanitizeTab(value, boards, chips);
            if (tab) tabs.push(tab);
        }
    }
    if (!tabs.some((tab) => tab.kind === "board")) {
        const board = Object.values(boards)[0];
        if (board) {
            tabs.unshift({kind: "board", id: board.id});
        }
    }

    const requestedIndex =
        typeof raw.activeIndex === "number" ? Math.round(raw.activeIndex) : 0;
    const activeIndex = Math.max(0, Math.min(tabs.length - 1, requestedIndex));

    return {boards, chips, tabs, activeIndex};
}

/** Restore a workspace from localStorage, or return null when there is none. */
export function loadWorkspace(defaultChips: ChipMap): Workspace | null {
    if (typeof localStorage === "undefined") {
        return null;
    }

    let raw: string | null;
    try {
        raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    } catch {
        return null;
    }
    if (!raw) {
        return null;
    }

    try {
        const stored: unknown = JSON.parse(raw);
        if (
            !isRecord(stored) ||
            stored.version !== WORKSPACE_STORAGE_VERSION
        ) {
            return null;
        }
        return sanitizeWorkspace(stored.workspace, defaultChips);
    } catch {
        return null;
    }
}

/**
 * Persist the workspace. Built-in chips are skipped because they are always
 * merged back from the app's bundled definitions when loading.
 */
export function saveWorkspace(workspace: Workspace): void {
    if (typeof localStorage === "undefined") {
        return;
    }

    const chips = Object.fromEntries(
        Object.entries(workspace.chips).filter(([, chip]) => !chip.builtIn),
    );

    try {
        localStorage.setItem(
            WORKSPACE_STORAGE_KEY,
            JSON.stringify({
                version: WORKSPACE_STORAGE_VERSION,
                workspace: {...workspace, chips},
            }),
        );
    } catch {
        // Storage can be unavailable or full; the app keeps working in memory.
    }
}
