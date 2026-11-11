export type NodeID = string;

export type DisplayFormat = 'decimal' | 'hex' | 'binary';

export type NodeBaseType = {
    type: 'input' | 'output' | "connection" | "chip" | "not" | "display";
    id: NodeID;
    leftPercent: number;
    topPercent: number;
    onMainCanvas: boolean;
    value: boolean;
}

export interface InputType extends NodeBaseType {
    type: 'input';
}

export interface OutputType extends NodeBaseType {
    type: 'output';
}

export interface ConnectionType extends NodeBaseType {
    type: 'connection';
    from: NodeID;
    to: NodeID;
}

export interface ChipType extends NodeBaseType {
    type: 'chip';
    inputs: NodeID[];
    outputs: NodeID[];
    nodes: { [key: string]: NodeType };
    name: string;
    /** Palette chip definition this placed instance came from, if any. */
    templateId?: NodeID;
}

export interface NotType extends NodeBaseType {
    type: 'not';
}

export interface DisplayType extends NodeBaseType {
    type: 'display';
    format: DisplayFormat;
    /** Number of character positions on the LCD. */
    digits: number;
    /** Whether the carry/overflow output pin is exposed. */
    showCarry: boolean;
    /** Binary data pins, least-significant bit first. */
    inputs: NodeID[];
    /** Carry/overflow output pin, if enabled. */
    outputs: NodeID[];
}

export type NodeType = InputType | OutputType | ConnectionType | ChipType | NotType | DisplayType;

export type NodesMap = { [key: string]: NodeType };

export type ChipMap = { [key: string]: ChipType };

export type BoardType = {
    id: NodeID;
    name: string;
    nodes: NodesMap;
};

export type BoardMap = { [key: string]: BoardType };