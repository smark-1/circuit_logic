import {NodeType} from "./types.ts";


export default function runner(nodes: {[key: string]: NodeType}, lastChange:NodeType) {
    const nodesCopy:{[key:string]:NodeType} = JSON.parse(JSON.stringify(nodes));

    const changedNodes:{[id:string]:{node:NodeType,duration:number}} = {};

    if(lastChange.type === 'not'){
        for (const node in nodesCopy) {
            if (nodesCopy[node].type === 'connection' && nodesCopy[node].from === lastChange.id) {
                nodesCopy[node].value = !lastChange.value;
                if(nodesCopy[node].onMainCanvas){
                    changedNodes[node] = {node:nodesCopy[node],duration:1000};
                }else{
                    changedNodes[node] = {node:nodesCopy[node],duration:10};
                }
            }
        }
    }else if(lastChange.type === 'input'){
        for (const node in nodesCopy) {
            if (nodesCopy[node].type === 'connection' && nodesCopy[node].from === lastChange.id) {
                nodesCopy[node].value = lastChange.value;
                if(nodesCopy[node].onMainCanvas){
                    changedNodes[node] = {node:nodesCopy[node],duration:1000};
                }else{
                    changedNodes[node] = {node:nodesCopy[node],duration:10};
                }
            }
        }
    } else if(lastChange.type === 'output'){
        for (const node in nodesCopy) {
            if (nodesCopy[node].type === 'connection' && nodesCopy[node].from === lastChange.id) {
                nodesCopy[node].value = lastChange.value;
                if(nodesCopy[node].onMainCanvas){
                    changedNodes[node] = {node:nodesCopy[node],duration:1000};
                }else{
                    changedNodes[node] = {node:nodesCopy[node],duration:10};
                }
            }
        }
    } else if (lastChange.type === 'connection') {
        const dups:{[id:string]:string[]} = {}
        for(const node in nodesCopy){
            if(nodesCopy[node].type === "connection"){
                if(dups[nodesCopy[node].to]){
                    dups[nodesCopy[node].to].push(node)
                }else{
                    dups[nodesCopy[node].to] = [node]
                }
            }
        }

        const nextNode = nodesCopy[lastChange.to];

        const prevValue = nextNode.value;

        // get the next nodes other connections
        const nextOtherConnections = dups[lastChange.to].filter((id)=>id!==lastChange.id);

        // if there are no other connections or it is turning on, set the value to the last change
        if(nextOtherConnections.length === 0 || lastChange.value){
            nextNode.value = lastChange.value;
        }else{
            // if there are other connections check if any are true
            let allFalse = true;

            for(const connection of nextOtherConnections){
                if(nodesCopy[connection].value){
                    allFalse = false;
                    break;
                }
            }

            // if all the other connections are false, set the value to the last change
            if(allFalse) {
                nextNode.value = lastChange.value;
            }
        }

        if(prevValue !== nextNode.value){
            changedNodes[nextNode.id] ={node:nextNode,duration:10};
            nodesCopy[nextNode.id] = nextNode;
        }
    }

    // return the next state of the nodes
    return {changed:changedNodes, nodes:nodesCopy};
}