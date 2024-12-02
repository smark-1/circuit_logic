import {useState} from "react";
import {ConnectionType, NodeID, NodeType, OutputType} from "../types.ts";

export default function OutputNode(props:{
    node:OutputType,
    setDrag:Function,
    drag:{start:null|NodeID,end:null|NodeID}
    setNodes:Function
}){
    const [on,setOn] = useState(false)

    return (
        <div onClick={()=>setOn(val=>!val)}
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