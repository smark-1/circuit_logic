export type NodeID = string;

export type NodeBaseType = {
    type: 'input' | 'output' | "connection" | "chip" | "not";
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
}

export interface NotType extends NodeBaseType {
    type: 'not';
}

export type NodeType = InputType | OutputType | ConnectionType | ChipType | NotType;