import { PIN_HIT_SIZE, PIN_SIZE } from "../constants.ts";

/**
 * A connection pin with a dot that is visually PIN_SIZE, but sits inside a
 * PIN_HIT_SIZE touch target so it can be grabbed reliably on a phone.
 *
 * The wrapper carries the data attributes the canvas uses to tell a
 * connection source from a sink; the dot itself stays pointer-events-none.
 */
export default function Pin(props: {
  nodeId: string;
  role: "source" | "sink";
  on: boolean;
  onClass: string;
  offClass: string;
  className?: string;
}) {
  return (
    <div
      data-node-id={props.nodeId}
      data-pin-role={props.role}
      className={`flex touch-none items-center justify-center ${props.className ?? ""}`}
      style={{ width: PIN_HIT_SIZE, height: PIN_HIT_SIZE }}
    >
      <div
        className={`${props.on ? props.onClass : props.offClass} pointer-events-none rounded-full border-2 duration-100`}
        style={{ width: PIN_SIZE, height: PIN_SIZE }}
      />
    </div>
  );
}
