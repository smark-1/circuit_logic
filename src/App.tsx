import Node from "./Nodes/Node.tsx";
import {useState} from "react";
import {InputType, OutputType, NodeType, NodeID, ChipType} from "./types.ts";

function GetAllIds(nodes:{[key:string]:NodeType}):NodeID[]{
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

function App() {
    const [nodes, setNodes] = useState<{[key:string]:NodeType}>({});
    const [chips, setChips] = useState<{[key:string]:ChipType}>({});
    const [drag,setDrag] = useState<{start:null|NodeID,end:null|NodeID}>({start:null,end:null})
    const [mousePos,setMousePos] = useState({x:0,y:0,width:0,height:0})

    const addNode=(e:MouseEvent)=>{
        if (e.target!==e.currentTarget) return;
        // e = Mouse click event.

        // @ts-expect-error
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left; //x position within the element.
        const y = e.clientY - rect.top;  //y position within the element.

        const id = Math.random().toString()

        let newNode = {id:id,leftPercent:(x/rect.width)*100,topPercent:(y/rect.height)*100} as NodeType
        if (newNode.leftPercent<=6){
            newNode = {...newNode,type:"input",leftPercent: 0,value:false} as InputType
        }else if (newNode.leftPercent>=94){
            newNode = {...newNode,type:"output",leftPercent: 100,value:false} as OutputType
        }else{
            const chipIds = Object.keys(chips)
            if (Object.keys(chipIds).length>0){
                // find and replace all ids in the chip with new random ids
                let chip = chips[chipIds[Math.floor(Math.random()*chipIds.length)]]
                let chipString = JSON.stringify(chip)


                for (const nodeId of GetAllIds(chip.nodes)){
                    chipString = chipString.replace(new RegExp(nodeId,"g"),Math.random().toString())
                }
                chip = JSON.parse(chipString)
                newNode = {...newNode,type:"chip",inputs:chip.inputs,outputs:chip.outputs,nodes:chip.nodes,name:chip.name} as ChipType
            }else{
                return;
            }
        }

        setNodes({...nodes,[id]:newNode})
    }
    const reactNodes = Object.values(nodes).map((node)=>{
        return <Node node={node}
                     key={node.id}
                     drag={drag}
                     setDrag={setDrag}
                     nodes={nodes}
                     setNodes={setNodes}
        />
    })

    const reactChips = Object.values(chips).map((chip)=>{
        return <div key={chip.id}>Chip: {chip.name}</div>
    })

    const handleMouseMove=(e:MouseEvent)=>{
        if(!e.currentTarget) return;
        // @ts-ignore
        const boundingRect = e.currentTarget.getBoundingClientRect()
        setMousePos({x:e.clientX-boundingRect.left,y:e.clientY-boundingRect.top,width: boundingRect.width,height: boundingRect.height})
    }


    return (
        <div className={"w-full h-screen bg-slate-900 p-8 flex"}>
            <div className={"w-[80vw] h-full bg-slate-800 relative"}
                 /* @ts-ignore */
                 onClick={addNode}
                 /* @ts-ignore */
                 onDragOver={(e)=>{handleMouseMove(e)
                         e.dataTransfer.dropEffect = "link";
                     e.preventDefault()
            }} onDrop={()=>{setDrag({start:null,end:null})}}>
                {reactNodes}

                {drag.start&&<div className={"absolute left-0 right-0 top-0 bottom-0 pointer-events-none"}>

                    <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
                        <line
                            x1={`${nodes[drag.start].leftPercent}%`}
                            y1={`${nodes[drag.start].topPercent}%`}
                            x2={`${mousePos.x}`} y2={`${mousePos.y}`}
                            strokeLinecap={"round"}
                            strokeLinejoin={"round"}
                            style={{stroke: "pink", strokeWidth: 4}}/>
                    </svg>
                </div>}

            </div>
            <div className={"h-full w-[20vw] bg-green-800"}>
                {reactChips}
                <button onClick={()=>{
                    const name = prompt("Chip name")
                    const id = Math.random().toString()
                    // @ts-ignore
                    const chip:ChipType = {
                        id:id,
                        type:"chip",
                        nodes:{...nodes},
                        // @ts-ignore
                        name:name,
                        // @ts-ignore
                        inputs:[Object.values(nodes).filter(node=>node.type==="input").map(node=>node.id)],
                        // @ts-ignore
                        outputs:[Object.values(nodes).filter(node=>node.type==="output").map(node=>node.id)]
                    }
                    setChips({...chips,[id]:chip})
                }}>save as chip</button>
            </div>
        </div>
    )
}

export default App
