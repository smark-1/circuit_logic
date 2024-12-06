import {ChipType} from "../types.ts";
import Node from "../Nodes/Node.tsx";


export default function Chip(props:{chip:ChipType}){

    const reactNodes = Object.values(props.chip.nodes).filter(node=>!['input','output'].includes(node.type)).map((node)=>{
        return <Node node={node}
                     key={node.id}

        />
    })

    const inputNodes = Object.values(props.chip.nodes).filter(node=>node.type==='input').map((node)=>{
        return <Node node={node}
                     key={node.id}

                     isChipIO={true}
        />
    })
    const outputNodes = Object.values(props.chip.nodes).filter(node=>node.type==='output').map((node)=>{
        return <Node node={node}
                     key={node.id}
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