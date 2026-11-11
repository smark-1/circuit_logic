import type { ChipType, DisplayType, NodeID, NodeType } from "../types.ts";
import { GATE_SIZE } from "../constants.ts";
import Node from "../Nodes/Node.tsx";
import { MiniDisplay } from "./Display.tsx";
import { useContext } from "react";
import { nodeContext } from "../appContext.ts";

function fallbackPin(
  id: NodeID,
  type: "input" | "output",
  index: number,
  total: number,
): NodeType {
  return {
    id,
    type,
    leftPercent: type === "input" ? 0 : 100,
    topPercent: ((index + 1) / (total + 1)) * 100,
    onMainCanvas: false,
    value: false,
  };
}

export default function Chip(props: { chip: ChipType }) {
  const nodesContext = useContext(nodeContext);
  const ioNodes = [
    ...props.chip.inputs.map((id, index) =>
      nodesContext.nodes[id] ??
      props.chip.nodes[id] ??
      fallbackPin(id, "input", index, props.chip.inputs.length),
    ),
    ...props.chip.outputs.map((id, index) =>
      nodesContext.nodes[id] ??
      props.chip.nodes[id] ??
      fallbackPin(id, "output", index, props.chip.outputs.length),
    ),
  ];

  const reactNodes = ioNodes.map((node) => (
    <Node node={node} key={node.id} isChipIO={true} />
  ));

  const displays = Object.values(props.chip.nodes).filter(
    (node): node is DisplayType => node.type === "display",
  );
  const ioNodesForBounds = [...props.chip.inputs, ...props.chip.outputs]
    .map((id) => props.chip.nodes[id])
    .filter((node): node is NodeType => Boolean(node));
  const ioYs = ioNodesForBounds.map((node) => node.topPercent);
  const minY = ioYs.length ? Math.min(...ioYs) : 0;
  const maxY = ioYs.length ? Math.max(...ioYs) : 100;

  return (
    <div
      className={
        "relative flex items-center justify-center rounded-lg bg-gray-600/90"
      }
      style={{ width: GATE_SIZE, height: GATE_SIZE }}
    >
      {displays.map((display) => {
        const top =
          maxY === minY
            ? 50
            : ((display.topPercent - minY) / (maxY - minY)) * 100;
        return (
          <div
            key={display.id}
            className={"pointer-events-none absolute"}
            style={{
              left: `${Math.min(92, Math.max(8, display.leftPercent))}%`,
              top: `${Math.min(88, Math.max(12, top))}%`,
              transform: "translate(-50%,-50%)",
            }}
          >
            <MiniDisplay
              display={display}
              nodes={nodesContext.nodes}
              fallback={props.chip.nodes}
            />
          </div>
        );
      })}
      {reactNodes}
      <p
        className={
          displays.length === 0
            ? "pointer-events-none text-center text-xl text-gray-50"
            : "pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-center text-[10px] text-gray-200"
        }
      >
        {props.chip.name}
      </p>
    </div>
  );
}
