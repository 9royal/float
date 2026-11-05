import test from 'node:test';
import assert from 'node:assert/strict';
import {LatheGeometry,Vector2} from 'three';
import {bowlProfile} from '../src/bowl.js';
import {TILT_HEIGHT_CM,TILT_SPILL_HEIGHT_CM,tiltPoint,tiltedSteelVolume,tiltedOuterVolume,tiltedCavityVolume,tiltedPuddleVolume,tiltedPuddleMesh,clipMeshBelow} from '../src/tilted-bowl.js';
import {OBJECTS,equilibrium,canCompareVolumes} from '../src/physics.js';
import {createExperiment,experimentReducer as act} from '../src/experiment.js';
import {morphMeshData} from '../src/morph.js';
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function meshVolume({positions:p,indices:id},originY=0){
 let sum=0;
 for(let i=0;i<id.length;i+=3){const a=id[i]*3,b=id[i+1]*3,c=id[i+2]*3;sum+=p[a]*((p[b+1]-originY)*p[c+2]-p[b+2]*(p[c+1]-originY))+(p[a+1]-originY)*(p[b+2]*p[c]-p[b]*p[c+2])+p[a+2]*(p[b]*(p[c+1]-originY)-(p[b+1]-originY)*p[c]);}
 return Math.abs(sum)/6;
}
const conserve=s=>near(600*s.water.levelCm-s.measured.displacedCm3+s.collectedCm3+s.retainedWaterCm3,9600);

test('the same side-tilted steel bowl fits fully below the overflow and displaces 100 cm³',()=>{
 assert.ok(TILT_HEIGHT_CM<16);near(tiltedSteelVolume(TILT_HEIGHT_CM),100);
 const q=equilibrium({object:OBJECTS.bowlSide});near(q.displacedCm3,100);near(q.buoyancyN,.98);near(q.weightN,7.644);near(q.bottomReactionN,6.664);assert.equal(q.sideWet,true);
});

test('partial steel displacement agrees with an independently rotated and clipped render mesh',()=>{
 const g=new LatheGeometry(bowlProfile().map(([r,y])=>new Vector2(r,y)),128);
 const p=g.attributes.position.array.slice();for(let i=0;i<p.length;i+=3)p.set(tiltPoint(p[i],p[i+1],p[i+2]),i);
 const mesh={positions:p,indices:Array.from(g.index.array)},factor=100/meshVolume(mesh);
 for(const height of [.5,1,2,4,8,12,15])near(meshVolume(clipMeshBelow(mesh,height),height)*factor,tiltedSteelVolume(height),.15);
 g.dispose();
});

test('side-tilted volume is monotonic and the exit puddle matches its actual clipped cavity mesh',()=>{
 let previous=0;for(let i=0;i<=100;i++){const v=tiltedSteelVolume(TILT_HEIGHT_CM*i/100);assert.ok(v>=previous-1e-6);previous=v;}
 const puddle=tiltedPuddleVolume();assert.ok(puddle>0&&puddle<100);
 near(puddle,tiltedCavityVolume(TILT_SPILL_HEIGHT_CM));near(meshVolume(tiltedPuddleMesh()),puddle,.2);
 near(tiltedOuterVolume(TILT_HEIGHT_CM)-tiltedCavityVolume(TILT_HEIGHT_CM),100);
});

test('side-tilted entry, lifting and return conserve every water volume and synchronize applied force',()=>{
 let s=act(createExperiment({objectId:'bowlSide'}),{type:'advance'});near(s.collectedCm3,100);near(s.retainedWaterCm3,0);conserve(s);
 for(const bottom of [0,.2,2,8,14,18,24,18,10,0]){
   s=act(s,{type:'hold',bottomCm:bottom});conserve(s);near(s.externalForce,s.measured.buoyancyN-s.measured.weightN);
   if(bottom>=18)near(s.retainedWaterCm3,tiltedPuddleVolume());
 }
 near(s.retainedWaterCm3,0);near(s.measured.displacedCm3,100);near(s.collectedCm3,100);
});

test('the material-shell overlay is gated to full immersion and keeps exactly the steel volume',()=>{
 let s=act(createExperiment({objectId:'bowlSide'}),{type:'advance'});
 assert.equal(canCompareVolumes(OBJECTS.bowlSide,s.measured,s.collectedCm3),true);
 for(let frame=0;frame<=20;frame++)near(meshVolume(morphMeshData({object:OBJECTS.bowlSide,draftCm:TILT_HEIGHT_CM,volumeCm3:100,progress:frame/20})),100,.001);
 s=act(s,{type:'hold',bottomCm:8});assert.equal(canCompareVolumes(OBJECTS.bowlSide,s.measured,s.collectedCm3),false);
 assert.throws(()=>morphMeshData({object:OBJECTS.bowlSide,draftCm:5,volumeCm3:10,progress:1}),/full immersion/);
});
