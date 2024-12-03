import {useEffect, useState} from "react";
import {ConnectionType, NodeID, NodeType, OutputType} from "../types.ts";

export default function OutputNode(props:{
    node:OutputType,
    setDrag:Function,
    drag:{start:null|NodeID,end:null|NodeID}
    setNodes:Function
    nodes:{[key:string]:NodeType}
}){
    const [on,setOn] = useState(false)

    const handleConnectionStateChange=(e:CustomEvent)=>{
        if (e.detail.to===props.node.id){
            if(e.detail.value===false){
                // @ts-ignore
                const connectedNodes = Object.values(props.nodes).filter(node=>node.type==="connection" && node.to===props.node.id)
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
    },[props.nodes])


    return (
        <div
             onDrop={(e)=>{
                    e.preventDefault();
                    if(props.drag.start!==null){
                        props.setDrag({start:null,end:null})
                        props.setNodes((nodes:{[key:string]:NodeType})=>{
                            const id = Math.random().toString()

                            const connectionNode: ConnectionType = {
                                id:id,
                                type:"connection",
                                // @ts-ignore
                                from:props.drag.start,
                                to:props.node.id,
                                leftPercent:0,
                                topPercent:0,
                                value:false
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