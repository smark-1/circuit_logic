import {ConnectionType, NodeType} from "../types.ts";

export default function ConnectionNode(props:{node:ConnectionType,nodes: {[key: string]: NodeType;};}){
    const fromNode = props.nodes[props.node.from]
    const toNode = props.nodes[props.node.to]

    return (
        <div className={"absolute left-0 right-0 top-0 bottom-0 pointer-events-none"}>

        <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
                <line
                    x1={`${fromNode.leftPercent}%`}
                    y1={`${fromNode.topPercent}%`}
                    x2={`${toNode.leftPercent}%`} y2={`${toNode.topPercent}%`}
                    strokeLinecap={"round"}
                    strokeLinejoin={"round"}
                    style={{stroke:"pink",strokeWidth:4}}/>
            </svg>
        </div>
    )
}
