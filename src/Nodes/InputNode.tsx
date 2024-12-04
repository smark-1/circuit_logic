import {useEffect, useState} from "react";
import {ConnectionType, InputType, NodeType} from "../types.ts";

export default function InputNode(props:{
    node:InputType,
    nodes:{[key:string]:NodeType},
    setDrag:Function,
    setNodes:Function,
    isChipInput?:boolean,
    drag:{start:null|string,end:null|string}
    setParentNodes?:Function
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
        const event = new CustomEvent("inputStateChange",{detail:{id:props.node.id,value:on}});
        window.dispatchEvent(event)
        props.setNodes((nodes:{[key:string]:InputType})=>{
            return {...nodes,[props.node.id]:{...props.node,value:on}}
        })
    },[on])

    useEffect(()=>{
        if(props.isChipInput){
            // @ts-ignore
            window.addEventListener("connectionStateChange",handleConnectionStateChange)
        }
        // @ts-ignore
        return ()=>{
            // @ts-ignore
            if(props.isChipInput){
                // @ts-ignore
                window.removeEventListener("connectionStateChange",handleConnectionStateChange)
            }
        }
    },[props.nodes])


    return (
        <div onClick={()=>{
            if(!props.isChipInput){
                setOn(val=>!val)
            }
        }
        }
             draggable={true}
             onDragStart={(e)=>{
                 if(props.isChipInput){
                     e.preventDefault()
                 }else{
                     e.dataTransfer.setDragImage(new Image(),0,0)
                     props.setDrag({start:props.node.id,end:null})
                 }
             }
             }
             onDrop={
                    (e)=>{
                        console.log("drop",e)
                        e.preventDefault();
                        if(props.isChipInput && props.drag.start!==null){
                            props.setDrag({start:null,end:null})
                            // @ts-ignore
                            props.setParentNodes((nodes:{[key:string]:NodeType})=>{
                                const id = Math.random().toString()
                                console.log("new connection to",props.node.id)
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
                    }
             }
             onDragOver={(e)=>{
                 if(props.isChipInput){
                     e.preventDefault()
                 }
             }}
             className={`${on?"bg-red-700":"bg-red-300"} border-2 w-7 h-7 rounded-full duration-100 ${!props.isChipInput&&'hover:bg-red-500'}`}></div>
    )
}