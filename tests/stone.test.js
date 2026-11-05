import test from 'node:test';
import assert from 'node:assert/strict';
import { stoneDisplacedByDraft,stoneDraftForVolume,stoneHeightCm,stoneTotalVolumeCm3,createStoneMeshData } from '../src/stone.js';
import {OBJECTS,volumeForDraft,draftForVolume,BOWL_CAPACITY_CM3,equilibrium,buoyancyN} from '../src/physics.js';
import {bowlOuterVolumeAt,bowlWaterCapacity} from '../src/bowl.js';

test('irregular stone has calibrated volume of 1000 cm³',()=>assert.ok(Math.abs(stoneTotalVolumeCm3-1000)<1e-8));
test('stone submerged volume is monotonic and bounded',()=>{
 let previous=0;
 for(let i=0;i<=100;i++){
  const v=stoneDisplacedByDraft(stoneHeightCm*i/100);
  assert.ok(v>=previous-1e-7);
  previous=v;
 }
 assert.ok(Math.abs(previous-1000)<1e-7);
});
test('stone submerged-volume inversion is accurate at all drafts',()=>{
 for(let i=1;i<100;i++){
   const v=10*i;
   assert.ok(Math.abs(stoneDisplacedByDraft(stoneDraftForVolume(v))-v)<1e-6);
 }
});
test('irregular model generates valid meshes',()=>{
 const geo=createStoneMeshData(stoneHeightCm*0.43);
 assert.ok(geo.positions.length>50);
 assert.ok(geo.indices.length>50);
 assert.ok(geo.positions.every(Number.isFinite));
 assert.ok(geo.indices.every(i=>i>=0&&i<geo.positions.length/3));
});
test('stone fully immersed has equal displacement and object volume',()=>{
 const r=equilibrium({object:OBJECTS.stone});
 assert.ok(Math.abs(r.displacedCm3-1000)<1e-6);
 assert.ok(Math.abs(r.buoyancyN-9.8)<1e-8);
 assert.ok(r.bottomReactionN>0);
});
test('bowl floats with hollow excluded volume rather than only iron volume',()=>{
 const r=equilibrium({object:OBJECTS.bowl,loadG:0});
 assert.equal(r.state,'漂浮平衡');
 assert.ok(Math.abs(r.displacedCm3-780)<1e-6);
 assert.ok(Math.abs(bowlOuterVolumeAt(r.draftCm)-780)<1e-6);
 assert.ok(Math.abs(r.buoyancyN-7.644)<1e-8);
});
test('bowl with heavy cargo floods and includes the retained water in total system weight',()=>{
 const r=equilibrium({object:OBJECTS.bowl,loadG:700});
 assert.equal(r.flooded,true);
 assert.equal(r.state,'進水沉底');
 assert.ok(Math.abs(r.displacedCm3-BOWL_CAPACITY_CM3)<1e-6);
 assert.ok(Math.abs(r.totalMassG-780-700-bowlWaterCapacity(700))<1e-6);
 assert.ok(r.bottomReactionN>0);
});
test('saltwater can carry more bowl cargo before flooding',()=>{
 const fresh=equilibrium({object:OBJECTS.bowl,densityGcm3:1,loadG:600});
 const salt=equilibrium({object:OBJECTS.bowl,densityGcm3:1.2,loadG:600});
 assert.equal(fresh.flooded,true);
 assert.equal(salt.flooded,false);
});
