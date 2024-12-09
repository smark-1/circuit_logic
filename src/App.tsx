import Node from "./Nodes/Node.tsx";
import {useEffect, useState} from "react";
import {InputType, OutputType, NodeType, NodeID, ChipType} from "./types.ts";
import {dragContext, nodeContext } from "./appContext.ts";
import {GetAllIds} from "./utils.ts";
import runner from "./runner.ts";
import Chip from "./Gates/Chip.tsx";


function App() {
    const [nodes, setNodes] = useState<{[key:string]:NodeType}>({});
    const [chips, setChips] = useState<{[key:string]:ChipType}>({});
    const [drag,setDrag] = useState<{start:null|NodeID,end:null|NodeID}>({start:null,end:null})
    const [initialDragPos,setInitialDragPos] = useState({x:0,y:0})
    const [mousePos,setMousePos] = useState({x:0,y:0,width:0,height:0})
    const [changedNodes,setChangedNodes] = useState<{node:NodeType,duration:number}[]|[]>([])

    useEffect(() => {
        if(changedNodes.length>0){
            for(let node of changedNodes){
                setTimeout(()=>{
                    handleNodeChange(node.node)
                },node.duration)
            }
            setChangedNodes([])
        }
    }, [changedNodes]);
    const addNode=(e:MouseEvent)=>{
        if (e.target!==e.currentTarget) return;

        // @ts-expect-error
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left; //x position within the element.
        const y = e.clientY - rect.top;  //y position within the element.

        const id = Math.random().toString()

        let newNode = {id:id,leftPercent:(x/rect.width)*100,topPercent:(y/rect.height)*100,onMainCanvas:true} as NodeType
        if (newNode.leftPercent<=6){
            newNode = {...newNode,type:"input",leftPercent: 0,value:false} as InputType
        }else if (newNode.leftPercent>=94){
            newNode = {...newNode,type:"output",leftPercent: 100,value:false} as OutputType
        }else{
            return;
        }

        setNodes(nodes=>({...nodes,[id]:newNode}))
    }

    const handleNodeChange=(node:NodeType)=>{
        setNodes(nodesState=> {
            const runValues = runner(nodesState, node)
            for(const id in runValues.changed){
                const n2 = runValues.changed[id]
                setChangedNodes(changes=>[...changes,n2])
            }
            return runValues.nodes
        }
    )


    }

    const reactNodes = Object.values(nodes).filter(node=>node.onMainCanvas).map((node)=>{
        return <div key={node.id} draggable={node.type==="chip"} onDragStart={(e)=>{
            if(node.type==="chip") {
                e.dataTransfer.setData("nodeMove", node.id)
            }
        }}
        ><Node node={node}
                     handleTriggerChange={(node)=>{
                         setNodes((nodes:{[key:string]:NodeType})=>{
                             const n2 = node
                                n2.value = !n2.value
                                return {...nodes,[node.id]:n2}
                         })
                         setChangedNodes([...changedNodes,{node,duration:10}])
                     }}
        /></div>
    })

    const reactChips = Object.values(chips).map((chip)=>{
        return <div key={chip.id} draggable={true} onDragStart={(e)=>{
            e.dataTransfer.setData("newChip",chip.id)
        }}>
            <div className={"pointer-events-none"}>
                <Chip chip={chip} />
            </div>
        </div>
    })

    const handleMouseMove= (e: React.DragEvent<HTMLDivElement>)=>{
        if(!e.currentTarget) return;
        // @ts-ignore
        const boundingRect = e.currentTarget.getBoundingClientRect()
        setMousePos({x:e.clientX-boundingRect.left,y:e.clientY-boundingRect.top,width: boundingRect.width,height: boundingRect.height})
    }


    return (
        <nodeContext.Provider value={{nodes,setNodes}}>
            <dragContext.Provider value={{drag, setDrag}}>
                <div className={"w-full h-screen bg-slate-900 p-8 flex"}>
                    <div className={"w-[80vw] h-full bg-slate-800 relative"}
                        /* @ts-ignore */
                         onClick={addNode}
                        /* @ts-ignore */
                         onDragOver={(e) => {
                             handleMouseMove(e)
                             e.dataTransfer.dropEffect = "link";
                             e.preventDefault()
                         }}
                         onDragStart={(e) => {
                             setInitialDragPos({x: e.pageX - 32, y: e.pageY - 32})
                         }}

                         onDrop={(event) => {
                             if(event.dataTransfer.getData("newChip")){
                                 const id = Math.random().toString()

                                 // @ts-ignore
                                 const rect = event.target.getBoundingClientRect();
                                 const x = event.clientX - rect.left; //x position within the element.
                                 const y = event.clientY - rect.top;  //y position within the element.


                                 let newNode = {id:id,leftPercent:(x/rect.width)*100,topPercent:(y/rect.height)*100,onMainCanvas:true} as NodeType

                                 const chipID = event.dataTransfer.getData("newChip")
                                 // // find and replace all ids in the chip with new random ids
                                 let chip = chips[chipID]
                                 let chipString = JSON.stringify(chip)


                                 for (const nodeId of GetAllIds(chip.nodes)){
                                     chipString = chipString.replace(new RegExp(nodeId,"g"),Math.random().toString())
                                 }
                                 chip = JSON.parse(chipString)
                                 newNode = {...newNode,type:"chip",inputs:chip.inputs,outputs:chip.outputs,nodes:chip.nodes,name:chip.name} as ChipType
                                 setNodes(nodes=>({...nodes,...chip.nodes,[id]:newNode}))
                             }else if(event.dataTransfer.getData("nodeMove")&&!drag.start){
                                    const id = event.dataTransfer.getData("nodeMove")
                                    setNodes((nodes:{[key:string]:NodeType})=>{
                                        const n2 = nodes[id]
                                        n2.leftPercent = (mousePos.x / mousePos.width) * 100
                                        n2.topPercent = (mousePos.y / mousePos.height) * 100
                                        return {...nodes,[id]:n2}
                                    })
                             }else {
                                 setDrag({start: null, end: null})
                             }
                         }}>
                        {reactNodes}

                        {drag.start && <div className={"absolute left-0 right-0 top-0 bottom-0 pointer-events-none"}>

                            <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
                                <line
                                    x1={`${initialDragPos.x}`}
                                    y1={`${initialDragPos.y}`}
                                    x2={`${mousePos.x}`} y2={`${mousePos.y}`}
                                    strokeLinecap={"round"}
                                    strokeLinejoin={"round"}
                                    style={{stroke: "pink", strokeWidth: 4}}/>
                            </svg>
                        </div>}

                    </div>
                    <div className={"h-full w-[20vw] bg-green-800 flex flex-col items-center p-2 space-y-4 overflow-auto"}>
                        {reactChips}
                    </div>
                </div>

                <button
                    className={"absolute bottom-4 left-4 p-2 bg-blue-500 text-white rounded-md uppercase"}

                    onClick={() => {
                    const name = prompt("Chip name")
                    const id = Math.random().toString()
                    // set all nodes to not be on main canvas
                    const nodeCopy = JSON.parse(JSON.stringify(nodes))
                    for (const id in nodeCopy) {
                        nodeCopy[id].onMainCanvas = false
                    }
                    const chip: ChipType = {
                        id: id,
                        type: "chip",
                        nodes: {...nodeCopy},
                        // @ts-ignore
                        name: name,
                        inputs: Object.values(nodes).filter(node => node.type === "input" && node.onMainCanvas).map(node => node.id),
                        outputs: Object.values(nodes).filter(node => node.type === "output"&& node.onMainCanvas).map(node => node.id),
                        onMainCanvas: false
                    }
                    setChips({...chips, [id]: chip})
                    setNodes({})
                }}>Save chip
                </button>
                <button className={"absolute bottom-4 left-32 p-2 bg-red-700 text-white rounded-md uppercase"}
                    onClick={()=>{
                        setNodes({})
                    }}
                >Clear</button>
            </dragContext.Provider>
        </nodeContext.Provider>
    )
}

export default App
