export type NodeID = string;

export type NodeType = {
    type: 'input' | 'output'|"connection";
    id: NodeID;
    leftPercent: number;
    topPercent: number;
}

export interface InputType extends NodeType {
    type: 'input';
    value:boolean;
}

export interface OutputType extends NodeType {
    type: 'output';
    value:boolean;
}

export interface ConnectionType extends NodeType {
    type: 'connection';
    from: NodeID;
    to: NodeID;
}