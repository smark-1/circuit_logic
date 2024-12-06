import {ChipType, ConnectionType, NodeType} from "../types.ts";
import {motion} from "motion/react"
import {useContext, useEffect, useRef, useState} from "react";
import {nodeContext} from "../appContext.ts";

function getNodes(nodes: { [p: string]: NodeType }, rectRef: React.MutableRefObject<HTMLDivElement | undefined>){
    let nodesList = {...nodes}
    // @ts-ignore
    let chipPercentWidth = 128/(rectRef.current?.offsetWidth)*100
    // @ts-ignore
    let chipPercentHeight = 128/(rectRef.current?.offsetHeight)*100

    // @ts-ignore
    Object.values(nodesList).filter(node=>node.type==="chip").forEach((node:ChipType)=>{
        Object.values(node.nodes).filter(node=>['input','output'].includes(node.type))
            .forEach((IOnode:NodeType)=>{
                nodesList[IOnode.id] = {
                    ...IOnode,
                    leftPercent: IOnode.type==="input"?node.leftPercent  - chipPercentWidth / 2:node.leftPercent  + chipPercentWidth / 2,
                    topPercent: node.topPercent  - chipPercentHeight / 2  + IOnode.topPercent * chipPercentHeight / 100
                }
            })
    })
    return nodesList
}

export default function ConnectionNode(props:{
    node:ConnectionType,
}){
    const rectRef = useRef<HTMLDivElement>()
    const nodesContext = useContext(nodeContext)
    const [on,setOn] = useState(false)
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

                if(!props.node.onMainCanvas){
                    setTimeout(()=>{
                        nodesContext.setNodes((nodes:{[key:string]:NodeType})=>{
                            return {...nodes,[props.node.id]:{...props.node,value:e.detail.value}}
                        })
                        const event = new CustomEvent("connectionStateChange",{detail:{id:props.node.id,value:e.detail.value, from:props.node.from,to:props.node.to}});
                        window.dispatchEvent(event)
                    },0)

                }
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

    if(!props.node.onMainCanvas){
        return null;
    }
    const nodesList = getNodes({...nodesContext.nodes},rectRef)
    const fromNode = nodesList[props.node.from]
    const toNode = nodesList[props.node.to]
    return (
        // @ts-ignore
        <div ref={rectRef} className={"absolute left-0 right-0 top-0 bottom-0 pointer-events-none"}>

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
                        nodesContext.setNodes((nodes:{[key:string]:NodeType})=>{
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
