import {useContext} from "react";
import {ConnectionType, NodeType, OutputType} from "../types.ts";
import {dragContext, nodeContext} from "../appContext.ts";

export default function OutputNode(props: {
    node: OutputType,
    isChipOutput?: boolean
}) {
    const nodesContext = useContext(nodeContext)
    const drag = useContext(dragContext)

    return (
        <div
            draggable={true}
            onDragStart={(e) => {
                if (props.isChipOutput) {
                    e.dataTransfer.setDragImage(new Image(), 0, 0)
                    drag.setDrag({start: props.node.id, end: null})
                } else {
                    e.preventDefault()
                }
            }
            }
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
                            to: props.node.id,
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
            className={`${props.node.value ? "bg-green-700" : "bg-gray-300"} border-2 w-7 h-7 rounded-full duration-100`}></div>
    )
}