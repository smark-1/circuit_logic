import {ConnectionType} from "../types.ts";
import {motion} from "motion/react"
import {useContext} from "react";
import {canvasContext, nodeContext} from "../appContext.ts";
import {CONNECTION_ANIMATION_SECONDS} from "../constants.ts";
import {nodeAnchorX} from "../geometry.ts";
import {getNodes} from "../utils.ts";
import type {TargetAndTransition} from "motion/react";

const variants: Record<"on" | "off", TargetAndTransition> = {
    on: {
        strokeDashoffset: [1, 0],
        opacity: 1,
    },
    off: {
        strokeDashoffset: [0, -1],
    },
}

export default function ConnectionNode(props: {
    node: ConnectionType,
}) {
    const nodesContext = useContext(nodeContext)
    const {width, height} = useContext(canvasContext)

    if (!props.node.onMainCanvas) {
        return null;
    }
    const nodesList = getNodes(nodesContext.nodes, width, height)
    const fromNode = nodesList[props.node.from]
    const toNode = nodesList[props.node.to]
    if (!fromNode || !toNode) {
        return null;
    }

    const fromX = nodeAnchorX(fromNode, "from", width)
    const toX = nodeAnchorX(toNode, "to", width)

    return (
        <div
            data-connection-id={props.node.id}
            className={"absolute left-0 right-0 top-0 bottom-0 pointer-events-none"}
        >
            <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
                <line
                    y1={`${fromNode.topPercent}%`}
                    x1={`${fromX}%`}
                    x2={`${toX}%`}
                    y2={`${toNode.topPercent}%`}
                    strokeLinecap={"round"}
                    strokeLinejoin={"round"}
                    style={{stroke: "pink", strokeWidth: 4}}/>
                <motion.line
                    variants={variants}
                    animate={props.node.value ? "on" : "off"}
                    transition={{duration: CONNECTION_ANIMATION_SECONDS}}
                    pathLength={1}
                    x1={`${fromX}%`}
                    y1={`${fromNode.topPercent}%`}
                    x2={`${toX}%`}
                    y2={`${toNode.topPercent}%`}
                    strokeLinecap={"round"}
                    strokeLinejoin={"round"}
                    strokeDasharray={1}
                    opacity={1}
                    strokeDashoffset={1}
                    style={{stroke: "red", strokeWidth: 4}}/>
            </svg>
        </div>
    )
}
