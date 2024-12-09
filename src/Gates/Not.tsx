import {ConnectionType, NodeType, NotType} from "../types.ts";
import {useContext} from "react";
import {dragContext, nodeContext} from "../appContext.ts";


export default function Not(props: { not: NotType }) {
    const nodesContext = useContext(nodeContext)
    const drag = useContext(dragContext)

    return (
        <div className={'p-4 bg-gray-600/90 rounded-lg relative w-32 h-32'}>
            <div
                onDrop={(e) => {
                    e.preventDefault();
                    if (drag.drag.start !== null) {
                        drag.setDrag({start: null, end: null})
                        nodesContext.setNodes((nodes: { [key: string]: NodeType }) => {
                            const id = Math.random().toString()
                            const connectionNode: ConnectionType = {
                                id: id,
                                type: "connection",
                                // @ts-ignore
                                from: drag.drag.start,
                                to: props.not.id,
                                leftPercent: 0,
                                topPercent: 0,
                                value: false,
                                onMainCanvas: true
                            }
                            return {...nodes, [id]: connectionNode}
                        })
                    }
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                }}
                style={
                    {
                        left: `0%`,
                        top: `50%`,
                        transform: `translate(-50%,-50%)`
                    }
                }
                className={`${props.not.value ? "bg-red-700" : "bg-red-300"} absolute border-2 w-7 h-7 rounded-full duration-100`}>

            </div>
            <div
                data-type={"outputNode"}
                style={
                    {
                        left: `100%`,
                        top: `50%`,
                        transform: `translate(-50%,-50%)`
                    }
                }

                draggable={true}
                onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', 'outputNode')
                    e.dataTransfer.setDragImage(new Image(), 0, 0)
                    drag.setDrag({start: props.not.id, end: null})
                }
                }
                onDragOver={(e) => {
                    e.preventDefault();
                }}

                className={`${!props.not.value ? "bg-green-700" : "bg-gray-300"} absolute border-2 w-7 h-7 rounded-full duration-100`}>
            </div>
            <p className={'text-xl text-gray-50 text-center'}>NOT</p>
        </div>
    )
}