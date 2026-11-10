import { useEffect, useState, type ReactNode } from "react";
import {
    DISPLAY_MAX_BITS,
    DISPLAY_MAX_DIGITS,
    DISPLAY_MIN_BITS,
    DISPLAY_MIN_DIGITS,
} from "./constants.ts";
import {
    displayMaxValue,
    formatDisplayValue,
    type DisplayConfig,
} from "./display.ts";
import type { DisplayFormat } from "./types.ts";

function choices(min: number, max: number): number[] {
    return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

/**
 * A small custom modal. Native prompt/alert/confirm dialogs are blocked in
 * sandboxed iframes, so every dialog in the app is rendered in the DOM.
 */
export function Dialog(props: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                props.onClose();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [props.onClose]);

    return (
        <div
            className={"fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4"}
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) {
                    props.onClose();
                }
            }}
        >
            <div
                role={"dialog"}
                aria-modal={"true"}
                aria-label={props.title}
                className={
                    "w-full max-w-sm rounded-xl border border-slate-600 bg-slate-800 p-4 text-slate-100 shadow-2xl"
                }
            >
                <h2 className={"mb-3 text-lg font-semibold"}>{props.title}</h2>
                {props.children}
            </div>
        </div>
    );
}

const inputClass =
    "w-full rounded-md border border-slate-500 bg-slate-900 px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-400";
const primaryButtonClass =
    "rounded-md bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
    "rounded-md bg-slate-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-500";

export function SaveChipDialog(props: {
    onCancel: () => void;
    onSave: (name: string) => void;
}) {
    const [name, setName] = useState("");

    return (
        <Dialog title={"Save chip"} onClose={props.onCancel}>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    const trimmed = name.trim();
                    if (trimmed) {
                        props.onSave(trimmed);
                    }
                }}
            >
                <label className={"mb-1 block text-xs uppercase tracking-wide text-slate-400"} htmlFor={"chip-name"}>
                    Chip name
                </label>
                <input
                    id={"chip-name"}
                    autoFocus
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={inputClass}
                    placeholder={"e.g. Half adder"}
                />
                <div className={"mt-4 flex justify-end gap-2"}>
                    <button type={"button"} className={secondaryButtonClass} onClick={props.onCancel}>
                        Cancel
                    </button>
                    <button type={"submit"} className={primaryButtonClass} disabled={!name.trim()}>
                        Save chip
                    </button>
                </div>
            </form>
        </Dialog>
    );
}

export function DisplayConfigDialog(props: {
    title: string;
    initial: DisplayConfig;
    onCancel: () => void;
    onSave: (config: DisplayConfig) => void;
}) {
    const [format, setFormat] = useState<DisplayFormat>(props.initial.format);
    const [digits, setDigits] = useState(props.initial.digits);
    const [bits, setBits] = useState(props.initial.bits);
    const [showCarry, setShowCarry] = useState(props.initial.showCarry);

    const maxValue = formatDisplayValue(
        displayMaxValue(format, digits),
        format,
    ).padStart(digits, "0");

    return (
        <Dialog title={props.title} onClose={props.onCancel}>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    props.onSave({ format, digits, bits, showCarry });
                }}
            >
                <div className={"grid gap-3"}>
                    <label className={"grid gap-1 text-xs uppercase tracking-wide text-slate-400"}>
                        Format
                        <select
                            className={inputClass}
                            value={format}
                            onChange={(event) => setFormat(event.target.value as DisplayFormat)}
                        >
                            <option value={"decimal"}>Decimal</option>
                            <option value={"hex"}>Hex</option>
                            <option value={"binary"}>Binary</option>
                        </select>
                    </label>

                    <div className={"grid grid-cols-2 gap-3"}>
                        <label className={"grid gap-1 text-xs uppercase tracking-wide text-slate-400"}>
                            Digits
                            <select
                                className={inputClass}
                                value={digits}
                                onChange={(event) => setDigits(Number(event.target.value))}
                            >
                                {choices(DISPLAY_MIN_DIGITS, DISPLAY_MAX_DIGITS).map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                ))}
                            </select>
                        </label>
                        <label className={"grid gap-1 text-xs uppercase tracking-wide text-slate-400"}>
                            Input bits
                            <select
                                className={inputClass}
                                value={bits}
                                onChange={(event) => setBits(Number(event.target.value))}
                            >
                                {choices(DISPLAY_MIN_BITS, DISPLAY_MAX_BITS).map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className={"flex items-center gap-2 text-sm text-slate-200"}>
                        <input
                            type={"checkbox"}
                            checked={showCarry}
                            onChange={(event) => setShowCarry(event.target.checked)}
                            className={"h-4 w-4 accent-cyan-500"}
                        />
                        Carry / overflow output
                    </label>

                    <p className={"rounded-md bg-slate-900/70 px-2 py-1.5 text-xs text-slate-400"}>
                        Shows up to <span className={"font-mono text-cyan-300"}>{maxValue}</span>.
                        The carry pin is high when a larger value needs another display.
                    </p>
                </div>

                <div className={"mt-4 flex justify-end gap-2"}>
                    <button type={"button"} className={secondaryButtonClass} onClick={props.onCancel}>
                        Cancel
                    </button>
                    <button type={"submit"} className={primaryButtonClass}>
                        {props.title.startsWith("Edit") ? "Save" : "Add display"}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}
