import { useContext } from "react";
import type { DisplayType, NodesMap, NodeType } from "../types.ts";
import { DISPLAY_WIDTH } from "../constants.ts";
import { nodeContext } from "../appContext.ts";
import { displayHeightPx } from "../geometry.ts";
import {
  DISPLAY_FORMAT_LABELS,
  displayDigitCount,
  displayOverflows,
  displayPinCount,
  displayText,
} from "../display.ts";
import Pin from "../Nodes/Pin.tsx";

function screenFontSize(text: string): number {
  return Math.max(
    9,
    Math.min(30, (DISPLAY_WIDTH - 58) / (Math.max(text.length, 1) * 0.62)),
  );
}

/**
 * A small LCD that reads a binary number from its input pins. The number of
 * input pins, the number of character positions, and the number base are all
 * configurable; the optional carry pin goes high when the value does not fit
 * in the configured digits.
 */
export default function Display(props: {
  display: DisplayType;
  onConfigure?: (nodeId: string) => void;
}) {
  const { nodes } = useContext(nodeContext);
  const pins = [
    ...props.display.inputs,
    ...(props.display.signInput ? [props.display.signInput] : []),
    ...props.display.outputs,
  ]
    .map((id) => nodes[id])
    .filter((node): node is NodeType => Boolean(node));
  const overflow = displayOverflows(nodes, props.display);
  const text = displayText(nodes, props.display);
  const height = displayHeightPx(displayPinCount(props.display));
  const bitLabels = new Map(
    props.display.inputs.map((id, bit) => [id, `b${bit}`]),
  );

  return (
    <div
      className={
        "group relative rounded-xl border-4 border-slate-500 bg-slate-700 shadow-lg"
      }
      style={{ width: DISPLAY_WIDTH, height }}
    >
      <div
        className={`absolute inset-x-3 top-3 rounded-md border-2 bg-[#07140f] px-2 py-1 shadow-inner ${
          overflow ? "border-red-500/80" : "border-cyan-950/80"
        }`}
        style={{ height: 68 }}
      >
        <div className={"flex items-center justify-between font-mono text-[9px] uppercase tracking-wide"}>
          <span className={"text-cyan-600"}>
            {DISPLAY_FORMAT_LABELS[props.display.format]}
          </span>
          <span className={overflow ? "text-red-400" : "text-cyan-700"}>
            {props.display.inputs.length} bit{props.display.signInput ? " ±" : ""}
          </span>
        </div>
        <div
          className={`flex h-[42px] items-center justify-end overflow-hidden font-mono tracking-wider ${
            overflow ? "text-red-400" : "text-emerald-300"
          }`}
          style={{ fontSize: screenFontSize(text) }}
          title={overflow ? "Value does not fit on this display" : text}
        >
          {text}
        </div>
      </div>

      {pins.map((pin) => (
        <div
          key={pin.id}
          className={"absolute"}
          style={{
            left: `${pin.leftPercent}%`,
            top: `${pin.topPercent}%`,
            transform: "translate(-50%,-50%)",
          }}
        >
          <Pin
            nodeId={pin.id}
            role={pin.type === "input" ? "sink" : "source"}
            on={pin.value}
            onClass={pin.type === "input" ? "bg-red-700" : "bg-green-700"}
            offClass={pin.type === "input" ? "bg-red-300" : "bg-gray-300"}
            label={bitLabels.get(pin.id) ?? (pin.id === props.display.signInput ? "±" : pin.type === "output" ? "C" : undefined)}
          />
        </div>
      ))}

      <span
        className={
          "pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 font-mono text-[8px] text-slate-400"
        }
      >
        {displayDigitCount(props.display.digits)} digits
      </span>

      {props.onConfigure && (
        <button
          type="button"
          className={
            "delete-reveal absolute -left-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white shadow-md transition hover:bg-cyan-500"
          }
          title={"Display settings"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            props.onConfigure?.(props.display.id);
          }}
        >
          ⚙
        </button>
      )}
    </div>
  );
}

/** A scaled-down copy of the LCD shown inside a saved chip. */
export function MiniDisplay(props: {
  display: DisplayType;
  nodes: NodesMap;
  fallback?: NodesMap;
}) {
  const overflow = displayOverflows(props.nodes, props.display, props.fallback);
  const text = displayText(props.nodes, props.display, props.fallback);
  const fontSize = Math.max(5, Math.min(13, 44 / Math.max(text.length, 1)));

  return (
    <div
      className={`flex items-center justify-center rounded-[3px] border bg-[#07140f] shadow-inner ${
        overflow ? "border-red-500/80" : "border-cyan-950/80"
      }`}
      style={{ width: 54, height: 32 }}
    >
      <span
        className={`font-mono tracking-wide ${
          overflow ? "text-red-400" : "text-emerald-300"
        }`}
        style={{ fontSize }}
      >
        {text}
      </span>
    </div>
  );
}
