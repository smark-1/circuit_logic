export type NodeID = string;

export type NodeType = {
    type: 'input' | 'output'|"connection" | "chip";
    id: NodeID;
    leftPercent: number;
    topPercent: number;
    onMainCanvas:boolean;
    value:boolean;
}

export interface InputType extends NodeType {
    type: 'input';
}

export interface OutputType extends NodeType {
    type: 'output';
}

export interface ConnectionType extends NodeType {
    type: 'connection';
    from: NodeID;
    to: NodeID;
}

export interface ChipType extends NodeType {
    type: 'chip';
    inputs: NodeID[];
    outputs: NodeID[];
    nodes:{[key:string]:NodeType};
    name:string;
}