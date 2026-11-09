import type { ChipType, NodeType } from "../types.ts";
import { GATE_SIZE } from "../constants.ts";
import Node from "../Nodes/Node.tsx";
import { useContext } from "react";
import { nodeContext } from "../appContext.ts";

export default function Chip(props: { chip: ChipType }) {
  const nodesContext = useContext(nodeContext);
  const ioIds = [...props.chip.inputs, ...props.chip.outputs];

  const reactNodes = ioIds
    .map((id) => nodesContext.nodes[id] ?? props.chip.nodes[id])
    .filter((node): node is NodeType => Boolean(node))
    .map((node) => <Node node={node} key={node.id} isChipIO={true} />);

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
