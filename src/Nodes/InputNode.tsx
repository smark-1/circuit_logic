import {useState} from "react";
import {InputType} from "../types.ts";

export default function InputNode(props:{node:InputType,setDrag:Function}){
    const [on,setOn] = useState(false)

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