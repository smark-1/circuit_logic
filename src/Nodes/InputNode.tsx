import {useContext} from "react";
import {ConnectionType, InputType, NodeType} from "../types.ts";
import {dragContext, nodeContext} from "../appContext.ts";

export default function InputNode(props:{
    node:InputType,
    isChipInput?:boolean,
    handleTriggerChange?:(node:NodeType)=>void
}){
    const nodesContext = useContext(nodeContext)
    const drag = useContext(dragContext)

    return (
        <div onClick={()=>{
            if(!props.isChipInput){
                if(props.handleTriggerChange) {
                    props.handleTriggerChange(props.node)
                }
            }
        }
        }
             draggable={true}
             onDragStart={(e)=>{
                 if(props.isChipInput){
                     e.preventDefault()
                 }else{
                     e.dataTransfer.setDragImage(new Image(),0,0)
                     drag.setDrag({start:props.node.id,end:null})
                 }
             }
             }
             onDrop={
                    (e)=>{
                        e.preventDefault();
                        if(props.isChipInput && drag.drag.start!==null){
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
                    }
             }
             onDragOver={(e)=>{
                 if(props.isChipInput){
                     e.preventDefault()
                 }
             }}
             className={`${props.node.value?"bg-red-700":"bg-red-300"} border-2 w-7 h-7 rounded-full duration-100 ${!props.isChipInput&&'hover:bg-red-500'}`}></div>
    )
}