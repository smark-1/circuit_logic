import type { InputType } from "../types.ts";
import Pin from "./Pin.tsx";

export default function InputNode(props: {
  node: InputType;
  pinRole: "source" | "sink";
  label?: string;
}) {
  return (
    <Pin
      nodeId={props.node.id}
      role={props.pinRole}
      on={props.node.value}
      onClass="bg-red-700"
      offClass="bg-red-300"
      label={props.label}
    />
  );
}
