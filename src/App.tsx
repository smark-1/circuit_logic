import Node from "./Nodes/Node.tsx";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ChipMap,
  ChipType,
  NodeID,
  NodesMap,
  NodeType,
  NotType,
} from "./types.ts";
import { canvasContext, nodeContext } from "./appContext.ts";
import { createId, remapChip } from "./utils.ts";
import { createConnection, deleteNode, settle } from "./runner.ts";
import { createSimulation, type Simulation } from "./simulation.ts";
import Chip from "./Gates/Chip.tsx";
import Not from "./Gates/Not.tsx";
import defaultChips from "./defaultChips.json";
import {
  DISPLAY_WIDTH,
  DRAG_THRESHOLD_PX,
  EDGE_ZONE_PX,
  GATE_SIZE,
  PIN_HIT_SIZE,
} from "./constants.ts";
import { clamp, clampPercentFromPx, displayHeightPx } from "./geometry.ts";
import {
  DEFAULT_DISPLAY_CONFIG,
  createDisplayNode,
  rebuildDisplay,
  type DisplayConfig,
} from "./display.ts";
import {
  ConfirmDialog,
  DisplayConfigDialog,
  SaveChipDialog,
} from "./dialogs.tsx";
import {
  applyChipTemplate,
  chipTemplateFromNodes,
  cloneNodesForEditing,
} from "./chipEditing.ts";
import {
  activeNodes,
  createInitialWorkspace,
  tabNodes,
  tabTitle,
  type TabType,
  type Workspace,
} from "./workspace.ts";

type Point = { x: number; y: number };
type PinRole = "source" | "sink";

type SessionBase = {
  pointerId: number;
  startClient: Point;
  client: Point;
  moved: boolean;
};

type DragSession =
  | (SessionBase & {
      kind: "connect";
      from: NodeID;
      fromRole: PinRole;
      fromPoint: Point;
    })
  | (SessionBase & { kind: "move"; id: NodeID; offset: Point })
  | (SessionBase & { kind: "canvas" })
  | (SessionBase & { kind: "palette"; chipId: string });

type DisplayDialogState = {
  id: NodeID | null;
  config: DisplayConfig;
  point: Point | null;
};

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nodeSize(node: NodeType): { width: number; height: number } {
  if (node.type === "display") {
    return {
      width: DISPLAY_WIDTH,
      height: displayHeightPx(node.inputs.length),
    };
  }
  return { width: GATE_SIZE, height: GATE_SIZE };
}

function findPinAt(
  clientX: number,
  clientY: number,
): { id: NodeID; role: PinRole } | null {
  const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const pin = element?.closest<HTMLElement>("[data-pin-role]");
  const id = pin?.dataset.nodeId;
  const role = pin?.dataset.pinRole;
  if (!id || (role !== "source" && role !== "sink")) {
    return null;
  }
  return { id, role };
}

function findSinkAt(clientX: number, clientY: number): NodeID | null {
  const pin = findPinAt(clientX, clientY);
  if (pin) {
    return pin.role === "sink" ? pin.id : null;
  }
  const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const sink = element?.closest<HTMLElement>("[data-sink-id]");
  return sink?.dataset.sinkId ?? null;
}

function App() {
  const [workspace, setWorkspaceState] = useState<Workspace>(() =>
    createInitialWorkspace(defaultChips as unknown as ChipMap),
  );
  const workspaceRef = useRef(workspace);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [connectPreview, setConnectPreview] = useState<{ from: Point; to: Point } | null>(null);
  const [palettePreview, setPalettePreview] = useState<{ chipId: string; client: Point } | null>(null);
  const [saveChipOpen, setSaveChipOpen] = useState(false);
  const [displayDialog, setDisplayDialog] = useState<DisplayDialogState | null>(null);
  const [closeTabIndex, setCloseTabIndex] = useState<number | null>(null);

  const boardCounterRef = useRef(1);
  const nodes = activeNodes(workspace);
  const chips = workspace.chips;
  const nodesRef = useRef(nodes);
  const canvasSizeRef = useRef(canvasSize);
  const sessionRef = useRef<DragSession | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const simulationRef = useRef<Simulation | null>(null);

  /** Update the workspace and keep the synchronous ref in step. */
  const setWorkspace = (updater: (current: Workspace) => Workspace) => {
    const next = updater(workspaceRef.current);
    if (next === workspaceRef.current) return;
    workspaceRef.current = next;
    setWorkspaceState(next);
  };

  /** Write the active tab's node map without losing the other tabs. */
  const applyNodes = (next: NodesMap, markDirty = true) => {
    nodesRef.current = next;
    const current = workspaceRef.current;
    const tab = current.tabs[current.activeIndex];
    if (!tab) return;

    if (tab.kind === "board") {
      setWorkspace((ws) => {
        const board = ws.boards[tab.id];
        if (!board) return ws;
        return {
          ...ws,
          boards: {...ws.boards, [tab.id]: {...board, nodes: next}},
        };
      });
      return;
    }

    setWorkspace((ws) => ({
      ...ws,
      tabs: ws.tabs.map((candidate, index) =>
        index === ws.activeIndex && candidate.kind === "chip"
          ? {...candidate, draft: next, dirty: candidate.dirty || markDirty}
          : candidate,
      ),
    }));
  };

  if (simulationRef.current === null) {
    simulationRef.current = createSimulation({
      getNodes: () => nodesRef.current,
      applyNodes: (next) => applyNodes(next, false),
      getCanvasSize: () => canvasSizeRef.current,
    });
  }
  const simulation = simulationRef.current!;

  /** React-state compatible setter used by the shared node context. */
  const setNodes = useCallback<React.Dispatch<React.SetStateAction<NodesMap>>>(
    (action) => {
      const previous = nodesRef.current;
      const next =
        typeof action === "function"
          ? (action as (current: NodesMap) => NodesMap)(previous)
          : action;
      applyNodes(next);
    },
    [],
  );

  useLayoutEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => () => cleanupRef.current?.(), []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      const size = { width: rect.width, height: rect.height };
      canvasSizeRef.current = size;
      setCanvasSize(size);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => simulation.clear(), [simulation]);

  const getCanvasRect = () => canvasRef.current?.getBoundingClientRect() ?? null;

  const addNodeAt = (point: Point) => {
    const rect = getCanvasRect();
    if (!rect) return;

    let type: "input" | "output";
    let leftPercent: number;
    if (point.x <= EDGE_ZONE_PX) {
      type = "input";
      leftPercent = 0;
    } else if (point.x >= rect.width - EDGE_ZONE_PX) {
      type = "output";
      leftPercent = 100;
    } else {
      return;
    }

    const id = createId();
    const newNode: NodeType =
      type === "input"
        ? {
            id,
            type,
            leftPercent,
            topPercent: clampPercentFromPx(point.y, PIN_HIT_SIZE, rect.height),
            onMainCanvas: true,
            value: false,
          }
        : {
            id,
            type,
            leftPercent,
            topPercent: clampPercentFromPx(point.y, PIN_HIT_SIZE, rect.height),
            onMainCanvas: true,
            value: false,
          };

    applyNodes({ ...nodesRef.current, [id]: newNode });
  };

  const addChipAt = (chipId: string, point: Point) => {
    const rect = getCanvasRect();
    if (!rect) return;

    const leftPercent = clampPercentFromPx(point.x, GATE_SIZE, rect.width);
    const topPercent = clampPercentFromPx(point.y, GATE_SIZE, rect.height);
    const id = createId();
    const current = nodesRef.current;

    if (chipId === "not") {
      const newNode: NotType = {
        id,
        type: "not",
        leftPercent,
        topPercent,
        onMainCanvas: true,
        value: false,
      };
      applyNodes({ ...current, [id]: newNode });
      return;
    }

    const template = workspaceRef.current.chips[chipId];
    if (!template) return;

    const chip = remapChip(template);
    const chipNodes = settle(chip.nodes);

    const newNode: ChipType = {
      id,
      type: "chip",
      leftPercent,
      topPercent,
      onMainCanvas: true,
      inputs: chip.inputs,
      outputs: chip.outputs,
      nodes: chipNodes,
      name: chip.name,
      templateId: chipId,
      value: false,
    };

    applyNodes({
      ...current,
      ...chipNodes,
      [id]: newNode,
    });
    simulation.primeConnections(chipNodes);
  };

  const addDisplayAt = (config: DisplayConfig, point: Point) => {
    const rect = getCanvasRect();
    if (!rect) return;

    const leftPercent = clampPercentFromPx(point.x, DISPLAY_WIDTH, rect.width);
    const topPercent = clampPercentFromPx(
      point.y,
      displayHeightPx(config.bits),
      rect.height,
    );
    const { display, pins } = createDisplayNode(
      config,
      leftPercent,
      topPercent,
    );
    applyNodes(settle({ ...nodesRef.current, ...pins, [display.id]: display }));
  };

  const openDisplayDialog = (point: Point | null, id: NodeID | null = null) => {
    if (id) {
      const node = nodesRef.current[id];
      if (node?.type !== "display") return;
      setDisplayDialog({
        id,
        point: null,
        config: {
          format: node.format,
          digits: node.digits,
          bits: node.inputs.length,
          showCarry: node.showCarry,
        },
      });
      return;
    }
    setDisplayDialog({ id: null, point, config: DEFAULT_DISPLAY_CONFIG });
  };

  const handleConfigureDisplay = (nodeId: NodeID) => {
    openDisplayDialog(null, nodeId);
  };

  const confirmDisplayDialog = (config: DisplayConfig) => {
    const dialog = displayDialog;
    setDisplayDialog(null);
    if (!dialog) return;

    if (dialog.id) {
      const current = nodesRef.current;
      const display = current[dialog.id];
      if (display?.type !== "display") return;

      const rebuilt = rebuildDisplay(current, display, config);
      simulation.forgetConnections(rebuilt.removedConnections);
      const settled = settle(rebuilt.nodes);
      applyNodes(settled);
      simulation.primeArrivals(settled);
      return;
    }

    if (dialog.point) {
      addDisplayAt(config, dialog.point);
    }
  };

  /** Add a connection from `from` to `to`, or report that it was invalid. */
  const connectFrom = (base: NodesMap, from: NodeID, to: NodeID): boolean => {
    const next = createConnection(base, from, to);
    if (next === base) {
      return false;
    }

    applyNodes(next);
    const created = Object.values(next).find(
      (node) => node.type === "connection" && !base[node.id],
    );
    if (created?.type === "connection") {
      simulation.startConnection(next, created.id);
    }
    return true;
  };

  const handleDelete = (nodeId: string) => {
    const session = sessionRef.current;
    if (
      session &&
      ((session.kind === "move" && session.id === nodeId) ||
        (session.kind === "connect" && session.from === nodeId))
    ) {
      cleanupRef.current?.();
    }

    const current = nodesRef.current;
    const next = deleteNode(current, nodeId);
    if (next === current) {
      return;
    }

    const removedConnections = Object.keys(current).filter(
      (id) => current[id].type === "connection" && !next[id],
    );
    simulation.forgetConnections(removedConnections);
    applyNodes(next);
    // Deleting is a structural change: trust the settled map immediately.
    simulation.primeArrivals(next);
  };

  const toggleInput = (nodeId: NodeID) => {
    const current = nodesRef.current;
    const node = current[nodeId];
    if (!node || node.type !== "input") {
      return;
    }

    const next = {
      ...current,
      [nodeId]: { ...node, value: !node.value },
    };
    applyNodes(next);
    simulation.emitFrom(next, nodeId);
  };

  const beginSession = (session: DragSession) => {
    cleanupRef.current?.();
    sessionRef.current = session;

    const handleMove = (event: PointerEvent) => {
      if (event.pointerId !== session.pointerId) return;

      session.client = { x: event.clientX, y: event.clientY };
      if (
        !session.moved &&
        distance(session.startClient, session.client) >= DRAG_THRESHOLD_PX
      ) {
        session.moved = true;
      }
      if (!session.moved) return;

      const rect = getCanvasRect();
      if (!rect) return;
      const local = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      if (session.kind === "connect") {
        setConnectPreview({ from: session.fromPoint, to: local });
        return;
      }

      if (session.kind === "move") {
        const current = nodesRef.current;
        const node = current[session.id];
        if (!node) return;

        const size = nodeSize(node);
        const centerX =
          rect.width <= size.width
            ? rect.width / 2
            : clamp(local.x - session.offset.x, size.width / 2, rect.width - size.width / 2);
        const centerY =
          rect.height <= size.height
            ? rect.height / 2
            : clamp(local.y - session.offset.y, size.height / 2, rect.height - size.height / 2);

        applyNodes({
          ...current,
          [session.id]: {
            ...node,
            leftPercent: (centerX / rect.width) * 100,
            topPercent: (centerY / rect.height) * 100,
          },
        });
        return;
      }

      if (session.kind === "palette") {
        setPalettePreview({ chipId: session.chipId, client: session.client });
      }
    };

    const handleUp = (event: PointerEvent) => {
      if (event.pointerId !== session.pointerId) return;

      const rect = getCanvasRect();
      const local = rect
        ? { x: event.clientX - rect.left, y: event.clientY - rect.top }
        : null;
      const insideCanvas =
        rect !== null &&
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (session.kind === "connect") {
        if (!session.moved) {
          const node = nodesRef.current[session.from];
          if (
            session.fromRole === "source" &&
            node?.type === "input" &&
            node.onMainCanvas
          ) {
            toggleInput(session.from);
          }
        } else {
          const target = findPinAt(event.clientX, event.clientY);
          let connected = false;

          if (target) {
            if (session.fromRole === "source" && target.role === "sink") {
              connected = connectFrom(nodesRef.current, session.from, target.id);
            } else if (session.fromRole === "sink" && target.role === "source") {
              connected = connectFrom(nodesRef.current, target.id, session.from);
            }
          }

          if (!connected && session.fromRole === "source") {
            const sinkId = findSinkAt(event.clientX, event.clientY);
            if (sinkId) {
              connected = connectFrom(nodesRef.current, session.from, sinkId);
            }
          }

          if (!connected && rect && local && insideCanvas) {
            let type: "input" | "output" | null = null;
            if (local.x <= EDGE_ZONE_PX) {
              type = "input";
            } else if (local.x >= rect.width - EDGE_ZONE_PX) {
              type = "output";
            }

            if (type) {
              const nodeId = createId();
              const newNode: NodeType = {
                id: nodeId,
                type,
                leftPercent: type === "input" ? 0 : 100,
                topPercent: clampPercentFromPx(local.y, PIN_HIT_SIZE, rect.height),
                onMainCanvas: true,
                value: false,
              };
              const withNode = { ...nodesRef.current, [nodeId]: newNode };
              const canConnect =
                (type === "output" && session.fromRole === "source") ||
                (type === "input" && session.fromRole === "sink");

              if (canConnect) {
                const sourceId = type === "input" ? nodeId : session.from;
                const sinkId = type === "input" ? session.from : nodeId;
                if (!connectFrom(withNode, sourceId, sinkId)) {
                  applyNodes(withNode);
                }
              } else {
                applyNodes(withNode);
              }
            }
          }
        }
      } else if (session.kind === "canvas") {
        if (!session.moved && local) {
          addNodeAt(local);
        }
      } else if (session.kind === "palette") {
        if (session.chipId === "lcd") {
          if (!session.moved) {
            if (rect) {
              openDisplayDialog({ x: rect.width / 2, y: rect.height / 2 });
            }
          } else if (insideCanvas && local) {
            openDisplayDialog(local);
          }
        } else if (!session.moved) {
          if (rect) {
            addChipAt(session.chipId, { x: rect.width / 2, y: rect.height / 2 });
          }
        } else if (insideCanvas && local) {
          addChipAt(session.chipId, local);
        }
      }

      cleanup();
    };

    const handleCancel = (event: PointerEvent) => {
      if (event.pointerId !== session.pointerId) return;
      cleanup();
    };

    function cleanup() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      sessionRef.current = null;
      cleanupRef.current = null;
      setConnectPreview(null);
      setPalettePreview(null);
    }

    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("[data-delete]")) return;

    const connectionDelete = target.closest<HTMLElement>("[data-delete-connection]");
    if (connectionDelete?.dataset.deleteConnection) {
      event.preventDefault();
      handleDelete(connectionDelete.dataset.deleteConnection);
      return;
    }

    const rect = getCanvasRect();
    if (!rect) return;

    const local = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const base: SessionBase = {
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      client: { x: event.clientX, y: event.clientY },
      moved: false,
    };

    const pin = target.closest<HTMLElement>("[data-pin-role]");
    if (pin) {
      const role = pin.dataset.pinRole;
      if ((role !== "source" && role !== "sink") || !pin.dataset.nodeId) {
        return;
      }

      event.preventDefault();
      const pinRect = pin.getBoundingClientRect();
      const fromPoint = {
        x: pinRect.left + pinRect.width / 2 - rect.left,
        y: pinRect.top + pinRect.height / 2 - rect.top,
      };
      beginSession({
        ...base,
        kind: "connect",
        from: pin.dataset.nodeId,
        fromRole: role,
        fromPoint,
      });
      setConnectPreview({ from: fromPoint, to: local });
      return;
    }

    const movable = target.closest<HTMLElement>('[data-movable="true"]');
    if (movable) {
      const id = movable.dataset.nodeId;
      const node = id ? nodesRef.current[id] : undefined;
      if (!id || !node) return;

      event.preventDefault();
      beginSession({
        ...base,
        kind: "move",
        id,
        offset: {
          x: local.x - (node.leftPercent / 100) * rect.width,
          y: local.y - (node.topPercent / 100) * rect.height,
        },
      });
      return;
    }

    if (target !== event.currentTarget) {
      return;
    }

    beginSession({ ...base, kind: "canvas" });
  };

  const startPaletteDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    chipId: string,
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const client = { x: event.clientX, y: event.clientY };
    beginSession({
      kind: "palette",
      chipId,
      pointerId: event.pointerId,
      startClient: client,
      client,
      moved: false,
    });
  };

  const settleActiveNodes = () => {
    const settled = settle(nodesRef.current);
    if (settled !== nodesRef.current) {
      applyNodes(settled, false);
    }
    return settled;
  };

  const activateTab = (index: number) => {
    const current = workspaceRef.current;
    if (index === current.activeIndex) return;

    const target = current.tabs[index];
    if (!target) return;

    cleanupRef.current?.();
    simulation.clear();
    settleActiveNodes();

    const currentTab = workspaceRef.current.tabs[index];
    if (!currentTab) return;
    const targetNodes = tabNodes(workspaceRef.current, currentTab);
    nodesRef.current = targetNodes;
    simulation.primeArrivals(targetNodes);
    setWorkspace((ws) => ({...ws, activeIndex: index}));
  };

  const addBoard = () => {
    cleanupRef.current?.();
    simulation.clear();
    settleActiveNodes();

    const id = createId();
    boardCounterRef.current += 1;
    const board = {
      id,
      name: `Board ${boardCounterRef.current}`,
      nodes: {} as NodesMap,
    };

    nodesRef.current = {};
    simulation.primeArrivals({});
    setWorkspace((ws) => ({
      ...ws,
      boards: {...ws.boards, [id]: board},
      tabs: [...ws.tabs, {kind: "board", id}],
      activeIndex: ws.tabs.length,
    }));
  };

  const performCloseTab = (index: number) => {
    const current = workspaceRef.current;
    const tab = current.tabs[index];
    if (!tab) return;

    const nextTabs = current.tabs.filter((_, candidate) => candidate !== index);
    if (nextTabs.length === 0) return;

    let nextActive = current.activeIndex;
    if (current.activeIndex === index) {
      nextActive = Math.max(0, index - 1);
    } else if (current.activeIndex > index) {
      nextActive -= 1;
    }
    nextActive = Math.min(nextActive, nextTabs.length - 1);

    const boards = tab.kind === "board"
      ? Object.fromEntries(
          Object.entries(current.boards).filter(([id]) => id !== tab.id),
        )
      : current.boards;

    if (current.activeIndex === index) {
      cleanupRef.current?.();
      simulation.clear();
      const target = nextTabs[nextActive];
      const targetNodes = target.kind === "board"
        ? boards[target.id]?.nodes ?? {}
        : target.draft;
      nodesRef.current = targetNodes;
      simulation.primeArrivals(targetNodes);
    }

    setWorkspace((ws) => ({
      ...ws,
      boards,
      tabs: nextTabs,
      activeIndex: nextActive,
    }));
    setCloseTabIndex(null);
  };

  const requestCloseTab = (index: number) => {
    const current = workspaceRef.current;
    const tab = current.tabs[index];
    if (!tab) return;

    if (tab.kind === "board") {
      const boardTabs = current.tabs.filter(
        (candidate) => candidate.kind === "board",
      ).length;
      if (boardTabs <= 1) return;
      const hasNodes =
        Object.keys(current.boards[tab.id]?.nodes ?? {}).length > 0;
      if (hasNodes) {
        setCloseTabIndex(index);
        return;
      }
    } else if (tab.dirty) {
      setCloseTabIndex(index);
      return;
    }

    performCloseTab(index);
  };

  const openChipEditor = (chipId: NodeID) => {
    const current = workspaceRef.current;
    const existing = current.tabs.findIndex(
      (tab) => tab.kind === "chip" && tab.chipId === chipId,
    );
    if (existing >= 0) {
      activateTab(existing);
      return;
    }

    const chip = current.chips[chipId];
    if (!chip) return;

    cleanupRef.current?.();
    simulation.clear();
    settleActiveNodes();

    const draft = settle(cloneNodesForEditing(chip.nodes));
    const tab: TabType = {kind: "chip", chipId, draft, dirty: false};
    nodesRef.current = draft;
    simulation.primeArrivals(draft);
    setWorkspace((ws) => ({
      ...ws,
      tabs: [...ws.tabs, tab],
      activeIndex: ws.tabs.length,
    }));
  };

  const saveChip = (name: string) => {
    if (!name.trim()) return;

    const current = nodesRef.current;
    const id = createId();
    const chip = chipTemplateFromNodes(name, current, id);

    cleanupRef.current?.();
    simulation.clear();
    setWorkspace((ws) => ({
      ...ws,
      chips: {...ws.chips, [id]: chip},
    }));
    applyNodes({});
  };

  const saveChipChanges = () => {
    const current = workspaceRef.current;
    const tab = current.tabs[current.activeIndex];
    if (!tab || tab.kind !== "chip") return;

    const base = current.chips[tab.chipId];
    if (!base) return;

    const template = chipTemplateFromNodes(
      base.name,
      tab.draft,
      base.id,
      base,
    );
    const applied = applyChipTemplate(
      current.boards,
      current.chips,
      tab.chipId,
      template,
    );

    cleanupRef.current?.();
    simulation.clear();
    nodesRef.current = tab.draft;
    simulation.primeArrivals(tab.draft);
    setWorkspace((ws) => ({
      ...ws,
      chips: applied.chips,
      boards: applied.boards,
      tabs: ws.tabs.map((candidate, index) =>
        index === ws.activeIndex && candidate.kind === "chip"
          ? {...candidate, dirty: false}
          : candidate,
      ),
    }));
  };

  const activeTab = workspace.tabs[workspace.activeIndex];
  const pendingCloseTab =
    closeTabIndex !== null ? workspace.tabs[closeTabIndex] : undefined;

  const visibleNodes = Object.values(nodes).filter((node) => node.onMainCanvas);
  const reactConnections = visibleNodes
    .filter((node) => node.type === "connection")
    .map((node) => <Node key={node.id} node={node} />);
  const reactNodes = visibleNodes
    .filter((node) => node.type !== "connection")
    .map((node) => (
      <div
        key={node.id}
        data-node-id={node.id}
        data-movable={
          ["not", "chip", "display"].includes(node.type) ? "true" : undefined
        }
      >
        <Node
          node={node}
          handleDelete={handleDelete}
          handleConfigure={handleConfigureDisplay}
        />
      </div>
    ));

  const reactChips = Object.values(chips).map((chip) => (
    <div
      key={chip.id}
      className={"relative shrink-0 cursor-grab touch-pan-x select-none"}
      onPointerDown={(event) => startPaletteDrag(event, chip.id)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className={"pointer-events-none"}>
        <Chip chip={chip} />
      </div>
      <button
        type={"button"}
        className={
          "delete-reveal absolute -right-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white shadow-md transition hover:bg-sky-500"
        }
        title={"Edit chip"}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          openChipEditor(chip.id);
        }}
      >
        ✎
      </button>
    </div>
  ));

  reactChips.push(
    <div
      key={"not"}
      className={"shrink-0 cursor-grab touch-pan-x select-none"}
      onPointerDown={(event) => startPaletteDrag(event, "not")}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className={"pointer-events-none"}>
        <Not
          not={{
            id: "not",
            leftPercent: 0,
            topPercent: 0,
            onMainCanvas: true,
            type: "not",
            value: false,
          }}
        />
      </div>
    </div>,
    <div
      key={"lcd"}
      className={"shrink-0 cursor-grab touch-pan-x select-none"}
      onPointerDown={(event) => startPaletteDrag(event, "lcd")}
      onContextMenu={(event) => event.preventDefault()}
      title={"LCD display"}
    >
      <div
        className={
          "pointer-events-none flex h-32 w-32 flex-col items-center justify-center rounded-lg border-4 border-slate-500 bg-slate-700 shadow-lg"
        }
      >
        <div
          className={
            "flex h-16 w-24 items-center justify-center rounded-md border-2 border-cyan-950 bg-[#07140f] font-mono text-lg tracking-widest text-emerald-300 shadow-inner"
          }
        >
          000
        </div>
        <span className={"mt-1 font-mono text-[9px] uppercase text-slate-300"}>
          LCD
        </span>
      </div>
    </div>,
  );

  const nodeContextValue = useMemo(() => ({ nodes, setNodes }), [nodes, setNodes]);
  const canvasContextValue = useMemo(
    () => ({ width: canvasSize.width, height: canvasSize.height }),
    [canvasSize.width, canvasSize.height],
  );
  const previewChip = palettePreview ? chips[palettePreview.chipId] : undefined;

  return (
    <nodeContext.Provider value={nodeContextValue}>
      <canvasContext.Provider value={canvasContextValue}>
        <div className={"flex h-dvh w-full flex-col overflow-hidden bg-slate-900"}>
          <div className={"flex items-center justify-between gap-2 px-2 pt-2 md:px-8 md:pt-4"}>
            <p className={"text-xs uppercase tracking-wide text-slate-400 md:text-sm"}>
              Circuit Logic
            </p>
            <div className={"flex gap-2"}>
              {activeTab?.kind === "chip" ? (
                <button
                  type="button"
                  className={"rounded-md bg-blue-500 p-2 text-xs text-white uppercase md:text-sm"}
                  onClick={saveChipChanges}
                >
                  Save changes
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={"rounded-md bg-blue-500 p-2 text-xs text-white uppercase md:text-sm"}
                    onClick={() => setSaveChipOpen(true)}
                  >
                    Save chip
                  </button>
                  <button
                    type="button"
                    className={"rounded-md bg-red-700 p-2 text-xs text-white uppercase md:text-sm"}
                    onClick={() => {
                      cleanupRef.current?.();
                      simulation.clear();
                      applyNodes({});
                    }}
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          <div
            className={
              "flex items-end gap-1 overflow-x-auto px-2 pt-2 md:px-8"
            }
          >
            {workspace.tabs.map((tab, index) => {
              const isActive = index === workspace.activeIndex;
              const dirty = tab.kind === "chip" && tab.dirty;
              const boardCount = workspace.tabs.filter(
                (candidate) => candidate.kind === "board",
              ).length;
              const closable =
                tab.kind === "chip" || boardCount > 1;
              const key =
                tab.kind === "board"
                  ? `board-${tab.id}`
                  : `chip-${tab.chipId}`;

              return (
                <div
                  key={key}
                  className={
                    "flex shrink-0 items-center gap-1 rounded-t-md border-b-2 px-2 py-1.5 " +
                    (isActive
                      ? "border-sky-400 bg-slate-700 text-slate-100"
                      : "border-transparent bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200")
                  }
                >
                  <button
                    type={"button"}
                    className={"max-w-40 cursor-pointer truncate text-xs font-medium md:text-sm"}
                    title={tabTitle(workspace, tab)}
                    onClick={() => activateTab(index)}
                  >
                    {tab.kind === "chip" ? "✎ " : ""}
                    {tabTitle(workspace, tab)}
                    {dirty ? " •" : ""}
                  </button>
                  {closable && (
                    <button
                      type={"button"}
                      className={
                        "flex h-5 w-5 items-center justify-center rounded text-sm leading-none text-slate-400 transition hover:bg-slate-600 hover:text-white"
                      }
                      title={"Close tab"}
                      aria-label={"Close tab"}
                      onClick={() => requestCloseTab(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            <button
              type={"button"}
              className={
                "mb-0.5 ml-1 shrink-0 rounded-md bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-600 md:text-sm"
              }
              onClick={addBoard}
              title={"Add board"}
            >
              + Board
            </button>
          </div>

          <div className={"flex min-h-0 flex-1 flex-col gap-2 p-2 md:flex-row md:p-8 md:pt-2"}>
            <div
              ref={canvasRef}
              className={"relative min-h-0 flex-1 touch-none overflow-hidden bg-slate-800 select-none"}
              onPointerDown={handleCanvasPointerDown}
              onContextMenu={(event) => event.preventDefault()}
            >
              <div className={"pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-slate-700/70 to-transparent"} />
              <div className={"pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-700/70 to-transparent"} />

              {reactConnections}
              {reactNodes}

              {connectPreview && (
                <div className={"pointer-events-none absolute inset-0"}>
                  <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
                    <line
                      x1={connectPreview.from.x}
                      y1={connectPreview.from.y}
                      x2={connectPreview.to.x}
                      y2={connectPreview.to.y}
                      strokeLinecap={"round"}
                      strokeLinejoin={"round"}
                      style={{ stroke: "pink", strokeWidth: 4 }}
                    />
                  </svg>
                </div>
              )}
            </div>

            <div
              className={"flex h-36 w-full shrink-0 gap-2 overflow-x-auto rounded-md bg-green-800 p-2 md:h-auto md:w-[20vw] md:flex-col md:items-center md:overflow-x-hidden md:overflow-y-auto"}
            >
              {reactChips}
            </div>
          </div>

          {palettePreview && (
            <div
              className={"pointer-events-none fixed z-50 opacity-80"}
              style={{
                left: palettePreview.client.x,
                top: palettePreview.client.y,
                transform: "translate(-50%,-50%)",
              }}
            >
              <div
                className={"flex items-center justify-center rounded-lg bg-gray-600/90 p-4 text-center text-xl text-gray-50"}
                style={{ width: GATE_SIZE, height: GATE_SIZE }}
              >
                {palettePreview.chipId === "not"
                  ? "NOT"
                  : palettePreview.chipId === "lcd"
                    ? "000"
                    : previewChip?.name ?? ""}
              </div>
            </div>
          )}

          {saveChipOpen && activeTab?.kind === "board" && (
            <SaveChipDialog
              onCancel={() => setSaveChipOpen(false)}
              onSave={(name) => {
                setSaveChipOpen(false);
                saveChip(name);
              }}
            />
          )}

          {closeTabIndex !== null && pendingCloseTab && (
            <ConfirmDialog
              title={
                pendingCloseTab.kind === "chip"
                  ? "Discard chip changes?"
                  : "Close board?"
              }
              message={
                pendingCloseTab.kind === "chip"
                  ? "This chip has unsaved changes. Closing the tab will discard them."
                  : "This board has components on it. Closing it will discard everything on the board."
              }
              confirmLabel={
                pendingCloseTab.kind === "chip" ? "Discard changes" : "Close board"
              }
              onCancel={() => setCloseTabIndex(null)}
              onConfirm={() => performCloseTab(closeTabIndex)}
            />
          )}

          {displayDialog && (
            <DisplayConfigDialog
              title={displayDialog.id ? "Edit display" : "Add display"}
              initial={displayDialog.config}
              onCancel={() => setDisplayDialog(null)}
              onSave={confirmDisplayDialog}
            />
          )}
        </div>
      </canvasContext.Provider>
    </nodeContext.Provider>
  );
}

export default App;
