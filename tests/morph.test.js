import test from 'node:test';
import assert from 'node:assert/strict';
import {OBJECTS,equilibrium} from '../src/physics.js';
import {morphMeshData,MORPH_SEGMENTS} from '../src/morph.js';
test('liquid starts as the beaker cylinder rather than an unrelated solid',()=>{
 const data=morphMeshData({object:OBJECTS.wood,draftCm:6,progress:0,volumeCm3:600});
 const p=data.positions;
 const height=p[(24*MORPH_SEGMENTS)*3+1]-p[1];
 assert.ok(Math.abs(height-600/(Math.PI*36))<.00001);
 for(let j=0;j<MORPH_SEGMENTS;j++)assert.ok(Math.abs(Math.hypot(p[j*3],p[j*3+2])-Math.hypot(p[0],p[2]))<.00001);
});
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
