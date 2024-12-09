import {ChipType, ConnectionType, InputType, NodeType, OutputType} from "../types";
import InputNode from "./InputNode.tsx";
import OutputNode from "./OutputNode.tsx";
import ConnectionNode from "./ConnectionNode.tsx";
import Chip from "../Gates/Chip.tsx";

export default function Node(props  : {
    node:NodeType,
    isChipIO?:boolean
    handleTriggerChange?:(node:NodeType)=>void
}){
    let element = <p>el</p>
    switch (props.node.type){
        case "input":
            element = <InputNode
                node={props.node as InputType }
                isChipInput={props.isChipIO}
                handleTriggerChange={props.handleTriggerChange}
            />
            break
        case "output":
            element = <OutputNode
                node={props.node as OutputType}
                isChipOutput={props.isChipIO}
            />
            break

        case "connection":
            element = <ConnectionNode node={props.node as ConnectionType} />
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