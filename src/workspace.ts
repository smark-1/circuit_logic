import { createId } from "./utils.ts";
import type {
    BoardMap,
    ChipMap,
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
