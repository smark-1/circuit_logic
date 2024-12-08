import {ChipType, NodeID, NodeType} from "./types.ts";

export function getNodes(nodes: { [p: string]: NodeType }, rectRef: React.MutableRefObject<HTMLDivElement | undefined>){
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


export function GetAllIds(nodes:{[key:string]:NodeType}):NodeID[]{
    let ids:NodeID[] = []
    for (const id in nodes){
        ids.push(id)
        if (nodes[id].type==="chip"){
            // @ts-ignore
            ids.push(...GetAllIds(nodes[id].nodes))
        }
    }
    return ids
}