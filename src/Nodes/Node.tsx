import {ConnectionType, InputType, NodeType, OutputType} from "../types";
import InputNode from "./InputNode.tsx";
import OutputNode from "./OutputNode.tsx";
import ConnectionNode from "./ConnectionNode.tsx";

export default function Node(props  : {
    node:NodeType,
    nodes:{[key:string]:NodeType}
    setNodes:Function,
    drag:{start:null|string,end:null|string},
    setDrag:Function}){
    let element = <p>el</p>
    switch (props.node.type){
        case "input":
            element = <InputNode node={props.node as InputType } setDrag={props.setDrag}/>
            break
        case "output":
            element = <OutputNode
                node={props.node as OutputType}
                setDrag={props.setDrag}
                drag={props.drag}
                setNodes={props.setNodes}/>
            break
        case "connection":
            element = <ConnectionNode node={props.node as ConnectionType} nodes={props.nodes} />
            break
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