import type { NodeType } from "../types";
import InputNode from "./InputNode.tsx";
import OutputNode from "./OutputNode.tsx";
import ConnectionNode from "./ConnectionNode.tsx";
import Chip from "../Gates/Chip.tsx";
import Not from "../Gates/Not.tsx";

export default function Node(props: {
  node: NodeType;
  isChipIO?: boolean;
  handleTriggerChange?: (node: NodeType) => void;
  handleDelete?: (nodeId: string) => void;
}) {
  let element = <p>el</p>;
  switch (props.node.type) {
    case "input":
      element = (
        <InputNode
          node={props.node}
          isChipInput={props.isChipIO}
          handleTriggerChange={props.handleTriggerChange}
        />
      );
      break;
    case "output":
      element = <OutputNode node={props.node} isChipOutput={props.isChipIO} />;
      break;

    case "connection":
      element = <ConnectionNode node={props.node} />;
      break;

    case "chip":
      element = <Chip chip={props.node} />;
      break;
    case "not":
      element = <Not not={props.node} />;
  }

  if (props.node.type === "connection") {
    return (
      <div>
        {element}
        {/* <button
          type="button"
          className="delete-button"
          onClick={() => props.handleDelete(props.node.id)}
        >
          Delete
        </button> */}
      </div>
    );
  }
  return (
    <div
      className={"absolute"}
      style={{
        left: `${props.node.leftPercent}%`,
        top: `${props.node.topPercent}%`,
        transform: "translate(-50%,-50%)",
      }}
    >
      {element}
      {props.isChipIO && props.handleDelete ? null : (
        <button
          type="button"
          className="delete-button absolute"
          // @ts-ignore
          onClick={() => props.handleDelete(props.node.id)}
        >
          Delete
        </button>
      )}
    </div>
  );
}
