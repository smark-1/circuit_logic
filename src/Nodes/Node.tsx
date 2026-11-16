import type { NodeType } from "../types";
import InputNode from "./InputNode.tsx";
import OutputNode from "./OutputNode.tsx";
import ConnectionNode from "./ConnectionNode.tsx";
import Chip from "../Gates/Chip.tsx";
import Not from "../Gates/Not.tsx";
import Display from "../Gates/Display.tsx";

export default function Node(props: {
  node: NodeType;
  isChipIO?: boolean;
  handleDelete?: (nodeId: string) => void;
  handleConfigure?: (nodeId: string) => void;
  handleChipAction?: (nodeId: string) => void;
  chipAction?: "edit" | "copy";
  label?: string;
}) {
  let element = <p>el</p>;
  switch (props.node.type) {
    case "input":
      element = (
        <InputNode
          node={props.node}
          pinRole={props.isChipIO ? "sink" : "source"}
          label={props.label}
        />
      );
      break;
    case "output":
      element = (
        <OutputNode
          node={props.node}
          pinRole={props.isChipIO ? "source" : "sink"}
          label={props.label}
        />
      );
      break;

    case "connection":
      element = <ConnectionNode node={props.node} />;
      break;

    case "chip":
      element = <Chip chip={props.node} />;
      break;
    case "not":
      element = <Not not={props.node} />;
      break;
    case "display":
      element = (
        <Display
          display={props.node}
          onConfigure={props.handleConfigure}
        />
      );
      break;
  }

  if (props.node.type === "connection") {
    return <div>{element}</div>;
  }

  const transform = props.isChipIO
    ? "translate(-50%,-50%)"
    : props.node.type === "input"
      ? "translate(0,-50%)"
      : props.node.type === "output"
        ? "translate(-100%,-50%)"
        : "translate(-50%,-50%)";

  return (
    <div
      className={"group absolute"}
      style={{
        left: `${props.node.leftPercent}%`,
        top: `${props.node.topPercent}%`,
        transform,
      }}
    >
      {element}
      {!props.isChipIO &&
        props.node.type === "chip" &&
        props.handleChipAction &&
        props.chipAction && (
          <button
            type="button"
            data-chip-action
            className={
              "delete-reveal absolute -top-2 -left-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white shadow-md transition hover:bg-sky-500"
            }
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              props.handleChipAction?.(props.node.id);
            }}
            title={props.chipAction === "copy" ? "Save as copy" : "Edit chip"}
          >
            {props.chipAction === "copy" ? "⧉" : "✎"}
          </button>
        )}
      {!props.isChipIO && props.handleDelete && (
        <button
          type="button"
          data-delete
          className={`delete-reveal absolute -top-2 ${
            props.node.type === "output" ? "-left-2" : "-right-2"
          } z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white opacity-70 shadow-md transition hover:bg-red-600`}
          onClick={(event) => {
            event.stopPropagation();
            props.handleDelete?.(props.node.id);
          }}
          title="Delete node"
        >
          ×
        </button>
      )}
    </div>
  );
}
