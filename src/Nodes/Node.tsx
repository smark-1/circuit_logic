import {ChipType, ConnectionType, InputType, NodeType, OutputType} from "../types";
import InputNode from "./InputNode.tsx";
import OutputNode from "./OutputNode.tsx";
import ConnectionNode from "./ConnectionNode.tsx";
import Chip from "../Gates/Chip.tsx";

export default function Node(props  : {
    node:NodeType,
    nodes:{[key:string]:NodeType}
    setNodes:Function,
    drag:{start:null|string,end:null|string},
    setDrag:Function}){
    let element = <p>el</p>
    switch (props.node.type){
        case "input":
            element = <InputNode node={props.node as InputType } setDrag={props.setDrag} setNodes={props.setNodes}/>
            break
        case "output":
            element = <OutputNode
                node={props.node as OutputType}
                nodes={props.nodes}
                setDrag={props.setDrag}
                drag={props.drag}
                setNodes={props.setNodes}/>
            break

        case "connection":
            element = <ConnectionNode node={props.node as ConnectionType} nodes={props.nodes} setNodes={props.setNodes} />
            break

        case "chip":
            element = <Chip chip={props.node as ChipType} />
            break;
    }

    if (props.node.type==="connection"){
        return element
    }
    return (
        <div className={"absolute"}
             style={
                {
                    left:`${props.node.leftPercent}%`,
                    top:`${props.node.topPercent}%`,
                    transform: `translate(-50%,-50%)`}}>
            {element}
        </div>
    )
}