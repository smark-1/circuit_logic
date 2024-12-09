import {ConnectionType} from "../types.ts";
import {motion} from "motion/react"
import {useContext, useEffect, useRef, useState} from "react";
import {nodeContext} from "../appContext.ts";
import {getNodes} from "../utils.ts";

export default function ConnectionNode(props: {
    node: ConnectionType,
}) {
    const rectRef = useRef<HTMLDivElement>()
    const nodesContext = useContext(nodeContext)
    const lineRef = useRef<SVGLineElement>()
    const [strokeTotalLength, setStrokeTotalLength] = useState(10000)

    const variants = {
        on: {
            strokeDashoffset: [strokeTotalLength, 0],
            opacity: 1,
        },
        off: {
            strokeDashoffset: [0, -strokeTotalLength],
        }
    }

    useEffect(() => {
        if (!lineRef.current) {
            return;
        }

        setTimeout(() => {
                if (lineRef.current) {
                    setStrokeTotalLength(lineRef.current.getTotalLength())
                }
            }
            , 50)
    }, [props.node])

    if (!props.node.onMainCanvas) {
        return null;
    }
    const nodesList = getNodes({...nodesContext.nodes}, rectRef)
    const fromNode = nodesList[props.node.from]
    const toNode = nodesList[props.node.to]
    let chipPercentWidth = 0
    if (rectRef.current) {
        chipPercentWidth = 128 / (rectRef.current.offsetWidth) * 100
    }

    return (
        // @ts-expect-error
        <div ref={rectRef} className={"absolute left-0 right-0 top-0 bottom-0 pointer-events-none"}>

            <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
                <line
                    // @ts-expect-error
                    ref={lineRef}
                    y1={`${fromNode.topPercent}%`}
                    x1={`${fromNode.type === 'not' ? fromNode.leftPercent + chipPercentWidth / 2 : fromNode.leftPercent}%`}
                    x2={`${toNode.type === "not" ? toNode.leftPercent - chipPercentWidth / 2 : toNode.leftPercent}%`}
                    y2={`${toNode.topPercent}%`}
                    strokeLinecap={"round"}
                    strokeLinejoin={"round"}
                    style={{stroke: "pink", strokeWidth: 4}}/>
                <motion.line
                    variants={variants}
                    animate={props.node.value ? "on" : "off"}
                    transition={{duration: strokeTotalLength / 1000}}
                    x1={`${fromNode.type === 'not' ? fromNode.leftPercent + chipPercentWidth / 2 : fromNode.leftPercent}%`}
                    y1={`${fromNode.topPercent}%`}
                    x2={`${toNode.type === "not" ? toNode.leftPercent - chipPercentWidth / 2 : toNode.leftPercent}%`}
                    y2={`${toNode.topPercent}%`}
                    strokeLinecap={"round"}
                    strokeLinejoin={"round"}
                    strokeDasharray={strokeTotalLength}
                    opacity={1}
                    strokeDashoffset={strokeTotalLength}
                    style={{stroke: "red", strokeWidth: 4}}/>
            </svg>
        </div>
    )
}
