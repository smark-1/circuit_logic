import type { NotType } from "../types.ts";
import { GATE_SIZE } from "../constants.ts";
import Pin from "../Nodes/Pin.tsx";

export default function Not(props: { not: NotType }) {
  return (
    <div
      data-sink-id={props.not.id}
      className={
        "relative flex items-center justify-center rounded-lg bg-gray-600/90"
      }
      style={{ width: GATE_SIZE, height: GATE_SIZE }}
    >
      <Pin
        nodeId={props.not.id}
        role="sink"
        on={props.not.value}
        onClass="bg-red-700"
        offClass="bg-red-300"
        className={"absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2"}
      />
      <Pin
        nodeId={props.not.id}
        role="source"
        on={!props.not.value}
        onClass="bg-green-700"
        offClass="bg-gray-300"
        className={
          "absolute top-1/2 left-full -translate-x-1/2 -translate-y-1/2"
        }
      />
      <p className={"pointer-events-none text-xl text-gray-50"}>NOT</p>
    </div>
  );
}
