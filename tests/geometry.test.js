import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoneMeshData,stoneDisplacedByDraft,stoneHeightCm} from '../src/stone.js';
import {morphMeshData} from '../src/morph.js';
import {OBJECTS,equilibrium,draftForVolume} from '../src/physics.js';

/** Independently verify a closed model's actual signed triangle-mesh volume. */
function signedMeshVolume({positions:p,indices:id}){
 let six=0;
 for(let i=0;i<id.length;i+=3){
  const ai=id[i]*3,bi=id[i+1]*3,ci=id[i+2]*3;
  const ax=p[ai],ay=p[ai+1],az=p[ai+2];
  const bx=p[bi],by=p[bi+1],bz=p[bi+2];
  const cx=p[ci],cy=p[ci+1],cz=p[ci+2];
  six+=ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx);
 }
 return six/6;
}
for(const frac of [.15,.4,.7,1])test(`stone 3D mesh volume matches cross-section integral at draft ${frac}`,()=>{
 const draft=stoneHeightCm*frac;
 assert.ok(Math.abs(signedMeshVolume(createStoneMeshData(draft))-stoneDisplacedByDraft(draft))<.01);
});
for(const object of Object.values(OBJECTS))test(`${object.id} morph has matching signed triangle volume at every phase`,()=>{
 const {draftCm,displacedCm3}=equilibrium({object});
 for(const progress of [0,.25,.5,.75,1]){
  const mesh=morphMeshData({object,draftCm,progress,volumeCm3:displacedCm3});
  assert.ok(Math.abs(signedMeshVolume(mesh)-displacedCm3)<.01);
 }
});

for(const object of Object.values(OBJECTS))test(`${object.id} actual rendered morph volume is conserved at partial drafts`,()=>{
 for(const fraction of [.01,.1,.33,.6,.9,1]){
  const volumeCm3=object.volumeCm3*fraction,draftCm=draftForVolume(object,volumeCm3);
  for(let frame=0;frame<=20;frame++){
   const mesh=morphMeshData({object,draftCm,volumeCm3,progress:frame/20});
   assert.ok(Math.abs(signedMeshVolume(mesh)-volumeCm3)<.01,`${object.id}, fraction ${fraction}, frame ${frame}`);
  }
 }
});
