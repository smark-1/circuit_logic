import {useEffect, useState} from "react";
import {InputType} from "../types.ts";

export default function InputNode(props:{node:InputType,setDrag:Function,setNodes:Function}){
    const [on,setOn] = useState(false)

    useEffect(()=>{
        const event = new CustomEvent("inputStateChange",{detail:{id:props.node.id,value:on}});
        window.dispatchEvent(event)
        props.setNodes((nodes:{[key:string]:InputType})=>{
            return {...nodes,[props.node.id]:{...props.node,value:on}}
        })
    },[on])

    return (
        <div onClick={()=>setOn(val=>!val)}
             draggable={true}
             onDragStart={(e)=>{
                 e.dataTransfer.setDragImage(new Image(),0,0)
                 // e.preventDefault();
                 props.setDrag({start:props.node.id,end:null})
             }
             }
             className={`${on?"bg-red-700":"bg-red-300"} border-2 w-7 h-7 rounded-full duration-100 hover:bg-red-500`}></div>
    )
}