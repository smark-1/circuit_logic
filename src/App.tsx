import Node from "./Nodes/Node.tsx";
import {
  type PointerEvent as ReactPointerEvent,
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
import { createConnection, deleteNode, propagate, settle } from "./runner.ts";
import Chip from "./Gates/Chip.tsx";
import Not from "./Gates/Not.tsx";
import defaultChips from "./defaultChips.json";
import {
  DRAG_THRESHOLD_PX,
  EDGE_ZONE_PX,
  GATE_SIZE,
  PIN_HIT_SIZE,
} from "./constants.ts";
import { clamp, clampPercentFromPx } from "./geometry.ts";

type Point = { x: number; y: number };

type SessionBase = {
  pointerId: number;
  startClient: Point;
  client: Point;
  moved: boolean;
};

type DragSession =
  | (SessionBase & { kind: "connect"; from: NodeID; fromPoint: Point })
  | (SessionBase & { kind: "move"; id: NodeID; offset: Point })
  | (SessionBase & { kind: "canvas" })
  | (SessionBase & { kind: "palette"; chipId: string });

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function findSinkAt(clientX: number, clientY: number): NodeID | null {
  const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const pin = element?.closest<HTMLElement>('[data-pin-role="sink"]');
  if (pin?.dataset.nodeId) {
    return pin.dataset.nodeId;
  }
  const sink = element?.closest<HTMLElement>("[data-sink-id]");
  return sink?.dataset.sinkId ?? null;
}

function App() {
  const [nodes, setNodes] = useState<NodesMap>({});
  const [chips, setChips] = useState<ChipMap>(defaultChips as ChipMap);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [connectPreview, setConnectPreview] = useState<{ from: Point; to: Point } | null>(null);
  const [palettePreview, setPalettePreview] = useState<{ chipId: string; client: Point } | null>(null);

  const nodesRef = useRef(nodes);
  const chipsRef = useRef(chips);
  const sessionRef = useRef<DragSession | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    chipsRef.current = chips;
  }, [chips]);

  useEffect(() => () => cleanupRef.current?.(), []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

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

    setNodes((nodesState) => ({ ...nodesState, [id]: newNode }));
  };

  const addChipAt = (chipId: string, point: Point) => {
    const rect = getCanvasRect();
    if (!rect) return;

    const leftPercent = clampPercentFromPx(point.x, GATE_SIZE, rect.width);
    const topPercent = clampPercentFromPx(point.y, GATE_SIZE, rect.height);
    const id = createId();

    if (chipId === "not") {
      const newNode: NotType = {
        id,
        type: "not",
        leftPercent,
        topPercent,
        onMainCanvas: true,
        value: false,
      };
      setNodes((nodesState) => ({ ...nodesState, [id]: newNode }));
      return;
    }

    const template = chipsRef.current[chipId];
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
      value: false,
    };

    setNodes((nodesState) => ({
      ...nodesState,
      ...chipNodes,
      [id]: newNode,
    }));
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
    setNodes((nodesState) => deleteNode(nodesState, nodeId));
  };

  const toggleInput = (nodeId: NodeID) => {
    setNodes((nodesState) => {
      const current = nodesState[nodeId];
      if (!current || current.type !== "input") {
        return nodesState;
      }
      const nextNodes = {
        ...nodesState,
        [current.id]: { ...current, value: !current.value },
      };
      return propagate(nextNodes, [current.id]);
    });
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
        const centerX =
          rect.width <= GATE_SIZE
            ? rect.width / 2
            : clamp(local.x - session.offset.x, GATE_SIZE / 2, rect.width - GATE_SIZE / 2);
        const centerY =
          rect.height <= GATE_SIZE
            ? rect.height / 2
            : clamp(local.y - session.offset.y, GATE_SIZE / 2, rect.height - GATE_SIZE / 2);

        setNodes((nodesState) => {
          const current = nodesState[session.id];
          if (!current) return nodesState;
          return {
            ...nodesState,
            [session.id]: {
              ...current,
              leftPercent: (centerX / rect.width) * 100,
              topPercent: (centerY / rect.height) * 100,
            },
          };
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
        if (session.moved) {
          const sinkId = findSinkAt(event.clientX, event.clientY);
          if (sinkId) {
            setNodes((nodesState) => createConnection(nodesState, session.from, sinkId));
          }
        } else {
          const node = nodesRef.current[session.from];
          if (node?.type === "input" && node.onMainCanvas) {
            toggleInput(session.from);
          }
        }
      } else if (session.kind === "canvas") {
        if (!session.moved && local) {
          addNodeAt(local);
        }
      } else if (session.kind === "palette") {
        if (!session.moved) {
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
      if (pin.dataset.pinRole !== "source" || !pin.dataset.nodeId) {
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

  const saveChip = () => {
    const name = prompt("Chip name");
    if (!name) return;

    const nodeCopy: NodesMap = {};
    for (const [nodeId, node] of Object.entries(nodes)) {
      nodeCopy[nodeId] = { ...node, onMainCanvas: false } as NodeType;
    }

    const id = createId();
    const chip: ChipType = {
      id,
      type: "chip",
      nodes: nodeCopy,
      name,
      inputs: Object.values(nodes)
        .filter((node) => node.type === "input" && node.onMainCanvas)
        .map((node) => node.id),
      outputs: Object.values(nodes)
        .filter((node) => node.type === "output" && node.onMainCanvas)
        .map((node) => node.id),
      onMainCanvas: false,
      leftPercent: 0,
      topPercent: 0,
      value: false,
    };

    cleanupRef.current?.();
    setChips((currentChips) => ({ ...currentChips, [id]: chip }));
    setNodes({});
  };

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
        data-movable={["not", "chip"].includes(node.type) ? "true" : undefined}
      >
        <Node node={node} handleDelete={handleDelete} />
      </div>
    ));

  const reactChips = Object.values(chips).map((chip) => (
    <div
      key={chip.id}
      className={"shrink-0 cursor-grab touch-pan-x select-none"}
      onPointerDown={(event) => startPaletteDrag(event, chip.id)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className={"pointer-events-none"}>
        <Chip chip={chip} />
      </div>
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
  );

  const nodeContextValue = useMemo(() => ({ nodes, setNodes }), [nodes]);
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
              <button
                type="button"
                className={"rounded-md bg-blue-500 p-2 text-xs text-white uppercase md:text-sm"}
                onClick={saveChip}
              >
                Save chip
              </button>
              <button
                type="button"
                className={"rounded-md bg-red-700 p-2 text-xs text-white uppercase md:text-sm"}
                onClick={() => {
                  cleanupRef.current?.();
                  setNodes({});
                }}
              >
                Clear
              </button>
            </div>
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
                {palettePreview.chipId === "not" ? "NOT" : previewChip?.name ?? ""}
              </div>
            </div>
          )}
        </div>
      </canvasContext.Provider>
    </nodeContext.Provider>
  );
}

export default App;
