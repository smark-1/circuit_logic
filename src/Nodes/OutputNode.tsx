import type { OutputType } from "../types.ts";
import Pin from "./Pin.tsx";

export default function OutputNode(props: {
  node: OutputType;
  pinRole: "source" | "sink";
}) {
  return (
    <Pin
      nodeId={props.node.id}
      role={props.pinRole}
      on={props.node.value}
      onClass="bg-green-700"
      offClass="bg-gray-300"
    />
  );
}
