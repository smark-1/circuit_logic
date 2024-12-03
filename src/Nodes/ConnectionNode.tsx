import {ConnectionType, NodeType} from "../types.ts";
import { motion } from "motion/react"
import {useEffect, useRef, useState} from "react";

export default function ConnectionNode(props:{
    node:ConnectionType,
    nodes: {[key: string]: NodeType}
    setNodes:Function
}){
    const [on,setOn] = useState(false)
    const fromNode = props.nodes[props.node.from]
    const toNode = props.nodes[props.node.to]
    const lineRef = useRef()
    const [strokeTotalLength,setStrokeTotalLength] = useState(10000)

    const variants = {
        on:{
            strokeDashoffset:[strokeTotalLength,0],
            opacity:1,
        },
        off:{
            strokeDashoffset: [0,-strokeTotalLength],
        }
    }

    useEffect(()=>{
        // @ts-ignore
        const inputChange = window.addEventListener("inputStateChange",(e:CustomEvent)=>{
            if (e.detail.id===props.node.from){
                setOn(e.detail.value)
            }
        })
        return ()=>{
            // @ts-ignore
            window.removeEventListener("inputStateChange",inputChange)
        }
    },[])

    useEffect(()=>{
        if(!lineRef.current){
            return;
        }

        setTimeout(()=>{
                // @ts-ignore
                setStrokeTotalLength(lineRef.current.getTotalLength())
        }
        ,50)
    },[])

    return (
        <div className={"absolute left-0 right-0 top-0 bottom-0 pointer-events-none"}>

            <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg" >
                <line
                    /* @ts-ignore */
                    ref={lineRef}
                    x1={`${fromNode.leftPercent}%`}
                    y1={`${fromNode.topPercent}%`}
                    x2={`${toNode.leftPercent}%`} y2={`${toNode.topPercent}%`}
                    strokeLinecap={"round"}
                    strokeLinejoin={"round"}
                    style={{stroke: "pink", strokeWidth: 4}}/>
                <motion.line
                    // key={props.node.id}
                    variants={variants}
                    animate={on ? "on" : "off"}
                    transition={{duration: strokeTotalLength/1000}}
                    onAnimationComplete={()=>{
                        props.setNodes((nodes:{[key:string]:NodeType})=>{
                            return {...nodes,[props.node.id]:{...props.node,value:on}}
                        })
                        const event = new CustomEvent("connectionStateChange",{detail:{id:props.node.id,value:on, from:props.node.from,to:props.node.to}});
                        window.dispatchEvent(event)
                    }}
                    x1={`${fromNode.leftPercent}%`}
                    y1={`${fromNode.topPercent}%`}
                    x2={`${toNode.leftPercent}%`} y2={`${toNode.topPercent}%`}
                    strokeLinecap={"round"}
                    strokeLinejoin={"round"}
                    strokeDasharray={strokeTotalLength}
                    opacity={1}
                    strokeDashoffset={strokeTotalLength}
                    style={{stroke: "red", strokeWidth: 4 }}/>
            </svg>
        </div>
    )
}
