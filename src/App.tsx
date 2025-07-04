import Node from "./Nodes/Node.tsx";
import { type DragEvent, type MouseEvent, useEffect, useState } from "react";
import type {
  ChipType,
  InputType,
  NodeID,
  NodeType,
  NotType,
  OutputType,
} from "./types.ts";
import { dragContext, nodeContext } from "./appContext.ts";
import { GetAllIds } from "./utils.ts";
import runner from "./runner.ts";
import Chip from "./Gates/Chip.tsx";
import Not from "./Gates/Not.tsx";
import defaultChips from "./defaultChips.json";

function App() {
  const [nodes, setNodes] = useState<{ [key: string]: NodeType }>({});
  const [chips, setChips] = useState<{ [key: string]: ChipType }>(
    defaultChips as { [key: string]: ChipType },
  );
  const [drag, setDrag] = useState<{
    start: null | NodeID;
    end: null | NodeID;
  }>({ start: null, end: null });
  const [initialDragPos, setInitialDragPos] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [changedNodes, setChangedNodes] = useState<
    { node: NodeType; duration: number }[] | []
  >([]);
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (changedNodes.length > 0) {
      for (const node of changedNodes) {
        setTimeout(() => {
          handleNodeChange(node.node);
        }, node.duration);
      }
      setChangedNodes([]);
    }
  }, [changedNodes]);

  // Update canvas rect when component mounts or window resizes
  useEffect(() => {
    const updateCanvasRect = () => {
      const canvasDiv = document.querySelector('.bg-slate-800') as HTMLElement;
      if (canvasDiv) {
        setCanvasRect(canvasDiv.getBoundingClientRect());
      }
    };

    updateCanvasRect();
    window.addEventListener('resize', updateCanvasRect);
    return () => window.removeEventListener('resize', updateCanvasRect);
  }, []);

  const addNode = (e: MouseEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;

    // Get the actual canvas div from the DOM
    const canvasDiv = document.querySelector('.bg-slate-800') as HTMLElement;
    if (!canvasDiv) return;

    const overlayRect = e.currentTarget.getBoundingClientRect();
    const canvasRect = canvasDiv.getBoundingClientRect();

    // Calculate position relative to the overlay
    const overlayX = e.clientX - overlayRect.left;
    const overlayY = e.clientY - overlayRect.top;

    // Define the extension area (reduce from 6% to 3% for more precision)
    const extensionPercent = 3;
    const extensionPixels = (canvasRect.width * extensionPercent) / 100;

    // Calculate where the canvas starts and ends within the overlay
    const canvasStartX = canvasRect.left - overlayRect.left;
    const canvasEndX = canvasRect.right - overlayRect.left;

    const id = Math.random().toString();

    let newNode = {
      id: id,
      leftPercent: 0,
      topPercent: (overlayY / overlayRect.height) * 100,
      onMainCanvas: true,
    } as NodeType;

    // Check if click is in the left extension area or within left 6% of canvas
    if (overlayX <= canvasStartX + extensionPixels) {
      newNode = {
        ...newNode,
        type: "input",
        leftPercent: 0,
        value: false,
      } as InputType;
    }
    // Check if click is in the right extension area or within right 6% of canvas
    else if (overlayX >= canvasEndX - extensionPixels) {
      newNode = {
        ...newNode,
        type: "output",
        leftPercent: 100,
        value: false,
      } as OutputType;
    } else {
      return;
    }

    setNodes((nodes) => ({ ...nodes, [id]: newNode }));
  };

  const handleNodeChange = (node: NodeType) => {
    setNodes((nodesState) => {
      const runValues = runner(nodesState, node);
      for (const id in runValues.changed) {
        const n2 = runValues.changed[id];
        setChangedNodes((changes) => [...changes, n2]);
      }
      return runValues.nodes;
    });
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
              setNodes((nodes) => {
                const nodeIdToDelete = node.id;
                const newNodes = { ...nodes };
                const nodeToDelete = newNodes[nodeIdToDelete];

                if (!nodeToDelete) {
                  // Nothing to delete
                  return newNodes;
                }

                // Handle chips specially
                if (nodeToDelete.type === "chip") {
                  // Gather all IDs that live inside this chip
                  let internalIds = Object.keys(nodeToDelete.nodes || {});

                  // Add inputs and outputs to the internal IDs list
                  if (nodeToDelete.inputs)
                    internalIds = internalIds.concat(nodeToDelete.inputs);
                  if (nodeToDelete.outputs)
                    internalIds = internalIds.concat(nodeToDelete.outputs);

                  console.log("inputs", nodeToDelete.inputs);
                  console.log("outputs", nodeToDelete.outputs);
                  console.log("internal ids", internalIds);

                  // Delete all internal nodes
                  for (const id of internalIds) {
                    delete newNodes[id];
                  }

                  // Find and delete all connection nodes that reference any input/output of this chip
                  const connectionsToDelete = [];

                  for (const nodeId in newNodes) {
                    const currentNode = newNodes[nodeId];

                    if (currentNode.type === "connection") {
                      console.log("checking connection", currentNode);

                      // Check if connection's 'from' or 'to' is in the chip's inputs or outputs arrays
                      const fromIsChipIO =
                        nodeToDelete.inputs?.includes(currentNode.from) ||
                        nodeToDelete.outputs?.includes(currentNode.from);

                      const toIsChipIO =
                        nodeToDelete.inputs?.includes(currentNode.to) ||
                        nodeToDelete.outputs?.includes(currentNode.to);

                      if (fromIsChipIO || toIsChipIO) {
                        connectionsToDelete.push(nodeId);
                        console.log("adding connection to delete:", nodeId);
                      }
                    }
                  }

                  // Delete all identified connection nodes
                  for (const id of connectionsToDelete) {
                    delete newNodes[id];
                  }
                } else {
                  // For non-chip nodes, delete any connection that references this node
                  const connectionsToDelete = [];

                  for (const nodeId in newNodes) {
                    const currentNode = newNodes[nodeId];

                    if (currentNode.type === "connection") {
                      if (
                        currentNode.from === nodeIdToDelete ||
                        currentNode.to === nodeIdToDelete
                      ) {
                        connectionsToDelete.push(nodeId);
                      }
                    }
                  }

                  // Delete all identified connection nodes
                  for (const id of connectionsToDelete) {
                    delete newNodes[id];
                  }
                }

                // Finally delete the node itself
                delete newNodes[nodeIdToDelete];
                console.log("new nodes", newNodes);
                return newNodes;
              });
              // Reset drag state if it references the deleted node
              setDrag((dragState) => {
                if (dragState.start === node.id || dragState.end === node.id) {
                  return { start: null, end: null };
                }
                return dragState;
              });
            }}
            node={node}
            handleTriggerChange={(node) => {
              setNodes((nodes: { [key: string]: NodeType }) => {
                const n2 = { ...node, value: !node.value };
                return { ...nodes, [node.id]: n2 };
              });
              setChangedNodes([...changedNodes, { node: { ...node, value: !node.value }, duration: 10 }]);
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
    if (!e.currentTarget) return;
    const boundingRect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - boundingRect.left,
      y: e.clientY - boundingRect.top,
      width: boundingRect.width,
      height: boundingRect.height,
    });
  };

  return (
    <nodeContext.Provider value={{ nodes, setNodes }}>
      <dragContext.Provider value={{ drag, setDrag }}>
        <div className={"w-full h-screen bg-slate-900 p-8 flex"}>
          {/* Original canvas with normal layout and drag/drop functionality */}
          <div
            className={"w-[80vw] h-full bg-slate-800 relative"}
            onClick={addNode}
            onDragOver={(e) => {
              handleMouseMove(e);
              e.dataTransfer.dropEffect = "link";
              e.preventDefault();
            }}
            onDragStart={(e) => {
              setInitialDragPos({ x: e.pageX - 32, y: e.pageY - 32 });
            }}
            onDrop={(event) => {
              if (event.dataTransfer.getData("newChip")) {
                const id = Math.random().toString();

                const rect = event.currentTarget.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;

                let newNode = {
                  id: id,
                  leftPercent: (x / rect.width) * 100,
                  topPercent: (y / rect.height) * 100,
                  onMainCanvas: true,
                } as NodeType;

                const chipID = event.dataTransfer.getData("newChip");

                if (chipID === "not") {
                  newNode = {
                    ...newNode,
                    type: "not",
                  } as NotType;
                  setNodes((nodes) => ({ ...nodes, [id]: newNode }));
                } else {
                  // find and replace all ids in the chip with new random ids
                  let chip = chips[chipID];
                  let chipString = JSON.stringify(chip);

                  for (const nodeId of GetAllIds(chip.nodes)) {
                    chipString = chipString.replace(
                      new RegExp(nodeId, "g"),
                      Math.random().toString(),
                    );
                  }
                  chip = JSON.parse(chipString);
                  newNode = {
                    ...newNode,
                    type: "chip",
                    inputs: chip.inputs,
                    outputs: chip.outputs,
                    nodes: chip.nodes,
                    name: chip.name,
                  } as ChipType;

                  setNodes((nodes) => ({
                    ...nodes,
                    ...chip.nodes,
                    [id]: newNode,
                  }));
                }
              } else if (
                event.dataTransfer.getData("nodeMove") &&
                !drag.start
              ) {
                const id = event.dataTransfer.getData("nodeMove");
                setNodes((nodes: { [key: string]: NodeType }) => {
                  const n2 = nodes[id];
                  n2.leftPercent = (mousePos.x / mousePos.width) * 100;
                  n2.topPercent = (mousePos.y / mousePos.height) * 100;
                  return { ...nodes, [id]: n2 };
                });
              } else {
                setDrag({ start: null, end: null });
              }
            }}
          >
            {reactNodes}

            {drag.start && (
              <div
                className={
                  "absolute left-0 right-0 top-0 bottom-0 pointer-events-none"
                }
              >
                <svg
                  height="100%"
                  width="100%"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <line
                    x1={`${initialDragPos.x}`}
                    y1={`${initialDragPos.y}`}
                    x2={`${mousePos.x}`}
                    y2={`${mousePos.y}`}
                    strokeLinecap={"round"}
                    strokeLinejoin={"round"}
                    style={{ stroke: "pink", strokeWidth: 4 }}
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Left extension area - positioned 20px to the left of canvas */}
          {canvasRect && (
            <div
              className={"absolute"}
              style={{
                left: canvasRect.left-20, // 20px outside canvas, minus 20px width
                top: canvasRect.top,
                width: '20px', // Fixed 20px width
                height: canvasRect.height,
                pointerEvents: 'auto',
              }}
              onClick={(e) => {
                // For left extension, always create input nodes
                if (e.target !== e.currentTarget) return;

                const id = Math.random().toString();
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;

                const newNode = {
                  id: id,
                  type: "input",
                  leftPercent: 0,
                  topPercent: (y / rect.height) * 100,
                  onMainCanvas: true,
                  value: false,
                } as InputType;

                setNodes((nodes) => ({ ...nodes, [id]: newNode }));
              }}
            />
          )}

          {/* Right extension area - positioned 20px to the right of canvas */}
          {canvasRect && (
            <div
              className={"absolute"}
              style={{
                left: canvasRect.right, // 20px outside right edge of canvas
                top: canvasRect.top,
                width: '20px', // Fixed 20px width
                height: canvasRect.height,
                pointerEvents: 'auto',
                zIndex: 10,
              }}
              onClick={(e) => {
                // For right extension, always create output nodes
                if (e.target !== e.currentTarget) return;

                const id = Math.random().toString();
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;

                const newNode = {
                  id: id,
                  type: "output",
                  leftPercent: 100,
                  topPercent: (y / rect.height) * 100,
                  onMainCanvas: true,
                  value: false,
                } as OutputType;

                setNodes((nodes) => ({ ...nodes, [id]: newNode }));
              }}
            />
          )}

          <div
            className={
              "h-full w-[20vw] bg-green-800 flex flex-col items-center p-2 space-y-4 overflow-auto"
            }
          >
            {reactChips}
          </div>
        </div>

        <button
          type="button"
          className={
            "absolute bottom-4 left-4 p-2 bg-blue-500 text-white rounded-md uppercase"
          }
          onClick={() => {
            const name = prompt("Chip name");
            const id = Math.random().toString();
            // set all nodes to not be on main canvas
            const nodeCopy = JSON.parse(JSON.stringify(nodes));
            for (const id in nodeCopy) {
              nodeCopy[id].onMainCanvas = false;
            }

            // if no name, don't save
            if (!name) return;

            const chip: ChipType = {
              id: id,
              type: "chip",
              nodes: { ...nodeCopy },
              name: name,
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
            setChips({ ...chips, [id]: chip });
            setNodes({});
          }}
        >
          Save chip
        </button>
        <button
          type="button"
          className={
            "absolute bottom-4 left-32 p-2 bg-red-700 text-white rounded-md uppercase"
          }
          onClick={() => {
            setNodes({});
          }}
        >
          Clear
        </button>
      </dragContext.Provider>
    </nodeContext.Provider>
    );
}

export default App;
