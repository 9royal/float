import test from 'node:test';
import assert from 'node:assert/strict';
import {OBJECTS,equilibrium} from '../src/physics.js';
import {morphMeshData} from '../src/morph.js';
for(const object of Object.values(OBJECTS)){
 test(`equal-volume morph for ${object.id}, all transition stages`,()=>{
  const state=equilibrium({object});
  if(state.flooded)return;
  for(const progress of [0,.05,.2,.5,.8,1]){
   const data=morphMeshData({object,draftCm:state.draftCm,progress,volumeCm3:state.displacedCm3});
   assert.ok(data.indices.length>1000);
   assert.ok(Math.abs(data.actualVolumeCm3-state.displacedCm3)<0.002,`${object.id} ${progress} volume ${data.actualVolumeCm3}`);
  }
 });
}
