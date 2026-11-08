import Node from "./Nodes/Node.tsx";
import { type DragEvent, type MouseEvent, useLayoutEffect, useRef, useState } from "react";
import type {
  ChipMap,
  ChipType,
  InputType,
  NodeID,
  NodesMap,
  NodeType,
  NotType,
  OutputType,
} from "./types.ts";
import { canvasContext, dragContext, nodeContext } from "./appContext.ts";
import { GetAllIds, createId } from "./utils.ts";
import { deleteNode, propagate } from "./runner.ts";
import Chip from "./Gates/Chip.tsx";
import Not from "./Gates/Not.tsx";
import defaultChips from "./defaultChips.json";
import { EDGE_ZONE_PX, GATE_SIZE, PIN_HIT_SIZE } from "./constants.ts";
import { clampPercentFromPx } from "./geometry.ts";

function App() {
  const [nodes, setNodes] = useState<NodesMap>({});
  const [chips, setChips] = useState<ChipMap>(
    defaultChips as ChipMap,
  );
  const [drag, setDrag] = useState<{
    start: null | NodeID;
    end: null | NodeID;
  }>({ start: null, end: null });
  const [initialDragPos, setInitialDragPos] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

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

  const addNode = (e: MouseEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let type: "input" | "output";
    let leftPercent: number;
    if (x <= EDGE_ZONE_PX) {
      type = "input";
      leftPercent = 0;
    } else if (x >= rect.width - EDGE_ZONE_PX) {
      type = "output";
      leftPercent = 100;
    } else {
      return;
    }

    const id = createId();
    const newNode = {
      id,
      type,
      leftPercent,
      topPercent: clampPercentFromPx(y, PIN_HIT_SIZE, rect.height),
      onMainCanvas: true,
      value: false,
    } as InputType | OutputType;

    setNodes((nodesState) => ({ ...nodesState, [id]: newNode }));
  };

  const reactNodes = Object.values(nodes)
    .filter((node) => node.onMainCanvas)
    .map((node) => {
      return (
        <div
          key={node.id}
          draggable={["not", "chip"].includes(node.type)}
          onDragStart={(e) => {
            e.dataTransfer.setData("nodeMove", node.id);
          }}
        >
          <Node
            handleDelete={() => {
              setNodes((nodesState) => deleteNode(nodesState, node.id));
              setDrag((dragState) => {
                if (dragState.start === node.id || dragState.end === node.id) {
                  return { start: null, end: null };
                }
                return dragState;
              });
            }}
            node={node}
            handleTriggerChange={(changedNode) => {
              setNodes((nodesState) => {
                const currentNode = nodesState[changedNode.id];
                if (!currentNode || currentNode.type !== "input") {
                  return nodesState;
                }
                const nextNodes = {
                  ...nodesState,
                  [currentNode.id]: { ...currentNode, value: !currentNode.value },
                };
                return propagate(nextNodes, [currentNode.id]);
              });
            }}
          />
        </div>
      );
    });

  const reactChips = Object.values(chips).map((chip) => {
    return (
      <div
        key={chip.id}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData("newChip", chip.id);
        }}
      >
        <div className={"pointer-events-none"}>
          <Chip chip={chip} />
        </div>
      </div>
    );
  });

  reactChips.push(
    <div
      key={"not"}
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData("newChip", "not");
      }}
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

  const handleMouseMove = (e: DragEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
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

    setChips((currentChips) => ({ ...currentChips, [id]: chip }));
    setNodes({});
    setDrag({ start: null, end: null });
  };

  const nodeContextValue = { nodes, setNodes };
  const canvasContextValue = { width: canvasSize.width, height: canvasSize.height };

  return (
    <nodeContext.Provider value={nodeContextValue}>
      <canvasContext.Provider value={canvasContextValue}>
        <dragContext.Provider value={{ drag, setDrag }}>
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
                    setNodes({});
                    setDrag({ start: null, end: null });
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
                onClick={addNode}
                onDragOver={(e) => {
                  handleMouseMove(e);
                  e.dataTransfer.dropEffect = "link";
                  e.preventDefault();
                }}
                onDragStart={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setInitialDragPos({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }}
                onDrop={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = event.clientX - rect.left;
                  const y = event.clientY - rect.top;
                  const leftPercent = clampPercentFromPx(x, GATE_SIZE, rect.width);
                  const topPercent = clampPercentFromPx(y, GATE_SIZE, rect.height);
                  const chipID = event.dataTransfer.getData("newChip");

                  if (chipID) {
                    const id = createId();

                    if (chipID === "not") {
                      const newNode: NotType = {
                        id,
                        type: "not",
                        leftPercent,
                        topPercent,
                        onMainCanvas: true,
                        value: false,
                      };
                      setNodes((nodesState) => ({ ...nodesState, [id]: newNode }));
                    } else {
                      const template = chips[chipID];
                      if (!template) return;

                      let chip = template;
                      let chipString = JSON.stringify(chip);

                      for (const nodeId of GetAllIds(chip.nodes)) {
                        chipString = chipString.replace(
                          new RegExp(nodeId, "g"),
                          createId(),
                        );
                      }
                      chip = JSON.parse(chipString);

                      const newNode: ChipType = {
                        id,
                        type: "chip",
                        leftPercent,
                        topPercent,
                        onMainCanvas: true,
                        inputs: chip.inputs,
                        outputs: chip.outputs,
                        nodes: chip.nodes,
                        name: chip.name,
                        value: false,
                      };

                      setNodes((nodesState) => ({
                        ...nodesState,
                        ...chip.nodes,
                        [id]: newNode,
                      }));
                    }
                  } else if (event.dataTransfer.getData("nodeMove") && !drag.start) {
                    const id = event.dataTransfer.getData("nodeMove");
                    setNodes((nodesState) => {
                      const current = nodesState[id];
                      if (!current) return nodesState;
                      return {
                        ...nodesState,
                        [id]: { ...current, leftPercent, topPercent },
                      };
                    });
                  } else {
                    setDrag({ start: null, end: null });
                  }
                }}
              >
                <div className={"pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-slate-700/70 to-transparent"} />
                <div className={"pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-700/70 to-transparent"} />

                {reactNodes}

                {drag.start && (
                  <div className={"pointer-events-none absolute inset-0"}>
                    <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
                      <line
                        x1={initialDragPos.x}
                        y1={initialDragPos.y}
                        x2={mousePos.x}
                        y2={mousePos.y}
                        strokeLinecap={"round"}
                        strokeLinejoin={"round"}
                        style={{ stroke: "pink", strokeWidth: 4 }}
                      />
                    </svg>
                  </div>
                )}
              </div>

              <div
                className={"flex h-36 w-full shrink-0 gap-2 overflow-x-auto rounded-md bg-green-800 p-2 md:h-auto md:w-[20vw] md:flex-col md:items-center md:overflow-x-hidden md:overflow-y-auto md:space-y-4"}
              >
                {reactChips}
              </div>
            </div>
          </div>
        </dragContext.Provider>
      </canvasContext.Provider>
    </nodeContext.Provider>
  );
}

export default App;
