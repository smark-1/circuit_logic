import {useContext, useEffect, useState} from "react";
import {ConnectionType, NodeType, OutputType} from "../types.ts";
import {dragContext, nodeContext} from "../appContext.ts";

export default function OutputNode(props:{
    node:OutputType,
    isChipOutput?:boolean
}){
    const [on,setOn] = useState(false)
    const nodesContext = useContext(nodeContext)
    const drag = useContext(dragContext)

    const handleConnectionStateChange=(e:CustomEvent)=>{
        if (e.detail.to===props.node.id){
            if(e.detail.value===false){
                // @ts-ignore
                const connectedNodes = Object.values(nodesContext.nodes).filter(node=>node.type==="connection" && node.to===props.node.id)
                const value = connectedNodes.some(node=>node.value)
                if(!value){
                    setOn(false);
                }
            }
            else {
                setOn(true)
            }
        }
    }
    useEffect(()=>{
        // @ts-ignore
        window.addEventListener("connectionStateChange",handleConnectionStateChange)
        return ()=>{
            // @ts-ignore
            window.removeEventListener("connectionStateChange",handleConnectionStateChange)
        }
    },[])


    return (
        <div
                draggable={true}
                onDragStart={(e)=>{
                    if(props.isChipOutput){
                        e.dataTransfer.setDragImage(new Image(),0,0)
                        drag.setDrag({start:props.node.id,end:null})
                    }else{
                        e.preventDefault()
                    }
                }
                }
             onDrop={(e)=>{
                    e.preventDefault();
                    if(drag.drag.start!==null){
                        drag.setDrag({start:null,end:null})
                        nodesContext.setNodes((nodes:{[key:string]:NodeType})=>{
                            const id = Math.random().toString()

                            const connectionNode: ConnectionType = {
                                id:id,
                                type:"connection",
                                // @ts-ignore
                                from:drag.drag.start,
                                to:props.node.id,
                                leftPercent:0,
                                topPercent:0,
                                value:false,
                                onMainCanvas:true
                            }
                            return {...nodes,[id]:connectionNode}
                        })
                    }
             }}
                onDragOver={(e)=>{
                    e.preventDefault();
                }}
             className={`${on?"bg-green-700":"bg-gray-300"} border-2 w-7 h-7 rounded-full duration-100`}></div>
    )
}