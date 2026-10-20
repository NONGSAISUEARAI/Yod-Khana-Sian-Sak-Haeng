import {validateArea} from './geometry.js';
export function selectAreaIds(current,primary,id,toggle=false){
 const ids=new Set(toggle?current:[]);
 if(toggle&&ids.has(id)){ids.delete(id);if(primary===id)primary=[...ids].at(-1)||null}else{ids.add(id);primary=id}
 return {ids,primary};
}
export function editAreaGroup(areas,ids,mutator,validateScene){
 const next=areas.map(a=>{if(!ids.has(a.id))return a;const edited=structuredClone(a);mutator(edited);validateArea(edited);return edited});validateScene(next);return next;
}
