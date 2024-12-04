import {ChipType} from "../types.ts";
import Node from "../Nodes/Node.tsx";
import {useState} from "react";

export default function Chip(props:{chip:ChipType,setParentNodes:Function,drag:{start:null|string,end:null|string},setDrag:Function}){
    const [nodeState,setNodeState] = useState(props.chip.nodes)

    const reactNodes = Object.values(nodeState).filter(node=>!['input','output'].includes(node.type)).map((node)=>{
        return <Node node={node}
                     key={node.id}
                     drag={props.drag}
                     setDrag={props.setDrag}
                     nodes={nodeState}
                     setNodes={setNodeState}
        />
    })

    const inputNodes = Object.values(nodeState).filter(node=>node.type==='input').map((node)=>{
        return <Node node={node}
                     key={node.id}
                     drag={props.drag}
                     setDrag={props.setDrag}
                     nodes={nodeState}
                     setNodes={setNodeState}
                     setParentNodes={props.setParentNodes}
                     isChipIO={true}
        />
    })
    const outputNodes = Object.values(nodeState).filter(node=>node.type==='output').map((node)=>{
        return <Node node={node}
                     key={node.id}
                     drag={{start:null,end:null}}
                     setDrag={props.setDrag}
                     nodes={nodeState}
                     setNodes={setNodeState}
                     isChipIO={true}
        />
    })

    return (
        <div className={'scale-75 p-4 bg-gray-600/90 rounded-lg relative'}>
            {inputNodes}
            {outputNodes}
            <div className={"relative w-32 h-32 scale-50 pointer-events-none"}>
                {reactNodes}
                <p className={'text-2xl text-gray-50'}>{props.chip.name}</p>
            </div>
        </div>
    )
}