import type { ChipType, NodeID, NodeType } from "../types.ts";
import { GATE_SIZE } from "../constants.ts";
import Node from "../Nodes/Node.tsx";
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

  return (
    <div
      className={
        "relative flex items-center justify-center rounded-lg bg-gray-600/90"
      }
      style={{ width: GATE_SIZE, height: GATE_SIZE }}
    >
      {reactNodes}
      <p className={"pointer-events-none text-center text-xl text-gray-50"}>
        {props.chip.name}
      </p>
    </div>
  );
}
