export type NodeID = string;

export type NodeType = {
    type: 'input' | 'output'|"connection";
    id: NodeID;
    leftPercent: number;
    topPercent: number;
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