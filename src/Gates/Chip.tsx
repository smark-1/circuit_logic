import {ChipType} from "../types.ts";
import Node from "../Nodes/Node.tsx";
import {useContext} from "react";
import {nodeContext} from "../appContext.ts";


export default function Chip(props: { chip: ChipType }) {
    const nodesContext = useContext(nodeContext)
    const IONodeIDs = [...props.chip.inputs, ...props.chip.outputs]

    const reactNodes = Object.values(nodesContext.nodes).filter((node) => {
        return IONodeIDs.includes(node.id)
    }).map((node) => {
        return <Node node={node}
                     key={node.id}

                     isChipIO={true}
        />
    })


    return (
        <div className={'p-4 bg-gray-600/90 rounded-lg relative w-32 h-32'}>
            {reactNodes}
            <p className={'text-xl text-gray-50 text-center'}>{props.chip.name}</p>
        </div>
    )
}