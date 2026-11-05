import test from 'node:test';
import assert from 'node:assert/strict';
import {createExperiment,experimentReducer as act} from '../src/experiment.js';
import {OBJECTS,INITIAL_LEVEL_CM,TANK_AREA_CM2,BOWL_CAPACITY_CM3,waterForPosition,equilibrium,volumeForDraft} from '../src/physics.js';
import {bowlWaterCapacity} from '../src/bowl.js';

const near=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const start=(objectId='wood')=>act(createExperiment({objectId}),{type:'advance'});
const conserve=s=>near(TANK_AREA_CM2*s.water.levelCm-s.measured.displacedCm3+s.collectedCm3+s.retainedWaterCm3,TANK_AREA_CM2*INITIAL_LEVEL_CM);

test('pressing and releasing wood preserves collected liquid and lowers the surface',()=>{
  let s=start();near(s.collectedCm3,600);
  s=act(s,{type:'hold',bottomCm:0});near(s.measured.displacedCm3,1000);near(s.collectedCm3,1000);conserve(s);
  s=act(s,{type:'hold',bottomCm:null});near(s.measured.displacedCm3,600);near(s.collectedCm3,1000);near(s.water.levelCm,15+1/3);conserve(s);
  s=act(s,{type:'advance'});s=act(s,{type:'advance'});assert.equal(s.phase,0,'mismatched water cannot enter overlay');
});

test('changing density resets collection even when an immersed iron volume is unchanged',()=>{
  let s=start('iron');
  s=act(s,{type:'hold',bottomCm:20});near(s.measured.displacedCm3,0);near(s.collectedCm3,1000);
  s=act(s,{type:'density',value:1.2});near(s.measured.displacedCm3,1000);near(s.collectedCm3,1000);near(s.water.levelCm,16);conserve(s);
  s=act(s,{type:'object',id:'wood'});s=act(s,{type:'advance'});near(s.measured.displacedCm3,500);near(s.collectedCm3,500);
});

test('flooding records the rim displacement before cavity water enters and stays flooded after unloading',()=>{
  let s=start('bowl');near(s.measured.displacedCm3,780);
  s=act(s,{type:'load',value:700});assert.equal(s.flooded,true);near(s.collectedCm3,BOWL_CAPACITY_CM3);near(s.measured.displacedCm3,BOWL_CAPACITY_CM3);near(s.retainedWaterCm3,bowlWaterCapacity(700));conserve(s);
  s=act(s,{type:'load',value:0});assert.equal(s.flooded,true);near(s.measured.displacedCm3,BOWL_CAPACITY_CM3);near(s.retainedWaterCm3,bowlWaterCapacity());near(s.collectedCm3,BOWL_CAPACITY_CM3);conserve(s);
  s=act(s,{type:'reset'});assert.equal(s.flooded,false);near(s.collectedCm3,0);
  s=act(s,{type:'advance'});assert.equal(s.flooded,false);near(s.measured.displacedCm3,780);
});

test('manual submergence floods an empty bowl but holding it above the water does not',()=>{
  let s=start('bowl');s=act(s,{type:'hold',bottomCm:0});assert.equal(s.flooded,true);conserve(s);
  assert.equal(equilibrium({object:OBJECTS.bowl,appliedForceN:18,manualFraction:0}).flooded,false);
});

test('fully immersed objects keep buoyancy and update the visible applied force at held depths',()=>{
  let s=start('iron');
  for(const bottomCm of [0,1,3,5]){
    s=act(s,{type:'hold',bottomCm});near(s.measured.displacedCm3,1000);near(s.measured.buoyancyN,9.8);near(s.measured.bottomReactionN,0);near(s.externalForce,-66.64);near(s.measured.appliedForceN,s.externalForce);near(s.measured.requiredHandForceN,0);conserve(s);
  }
});

test('held irregular stone uses its actual cross section with a self-consistent waterline',()=>{
  const object=OBJECTS.stone;
  for(const bottomCm of [0,4,9,12,15,18]){
    const s=waterForPosition({object,bottomCm,previouslyCollectedCm3:1000});
    near(TANK_AREA_CM2*s.levelCm-s.displacedCm3+s.collectedCm3,9600);
    assert.ok(s.displacedCm3>=0&&s.displacedCm3<=1000+1e-6);
  }
});

test('all object, density and force combinations balance supported forces and conserve tank liquid',()=>{
  for(const object of Object.values(OBJECTS))for(const density of [1,1.1,1.2])for(const fraction of [-1,-.5,0,.5,1]){
    let s=start(object.id);s=act(s,{type:'density',value:density});s=act(s,{type:'force',value:object.maxForce*fraction});
    conserve(s);assert.ok(Number.isFinite(s.measured.buoyancyN));assert.ok(s.measured.bottomCm>=0);
    if(s.measured.state!=='向上離水')near(s.measured.buoyancyN+s.measured.bottomReactionN,s.measured.weightN+s.externalForce);
  }
});

test('reset and changing objects clear the manual constraint, load, overflow, and comparison phase',()=>{
  let s=start('bowl');s=act(s,{type:'load',value:1000});s=act(s,{type:'hold',bottomCm:12});
  s=act(s,{type:'object',id:'stone'});assert.equal(s.started,false);assert.equal(s.manualBottomCm,null);assert.equal(s.loadG,0);assert.equal(s.phase,0);near(s.collectedCm3,0);
});

test('invalid UI values cannot poison the experiment',()=>{
  const s=start();for(const action of [{type:'density',value:NaN},{type:'density',value:3},{type:'force',value:Infinity},{type:'hold',bottomCm:NaN},{type:'load',value:NaN},{type:'object',id:'missing'}])assert.equal(act(s,action),s);
});

test('a flooded bowl can be lifted into partial immersion with a balanced upward force',()=>{
 let s=start('bowl');s=act(s,{type:'load',value:700});s=act(s,{type:'load',value:0});s=act(s,{type:'force',value:-7});
 assert.equal(s.flooded,true);assert.equal(s.measured.state,'進水平衡');assert.ok(s.measured.draftCm<OBJECTS.bowl.heightCm);
 near(s.measured.buoyancyN,s.measured.weightN-7);near(s.measured.bottomReactionN,0);near(volumeForDraft(OBJECTS.bowl,s.measured.draftCm),s.measured.displacedCm3);near(s.retainedWaterCm3,bowlWaterCapacity());conserve(s);
});

test('a flooded bowl leaves the liquid under a pull greater than its weight',()=>{
 let s=start('bowl');s=act(s,{type:'load',value:700});s=act(s,{type:'load',value:0});s=act(s,{type:'force',value:-35});
 assert.equal(s.flooded,true);assert.equal(s.measured.state,'向上離水');near(s.measured.draftCm,0);near(s.measured.displacedCm3,0);near(s.measured.bottomReactionN,0);near(s.collectedCm3,BOWL_CAPACITY_CM3);conserve(s);
});

test('lifting a sunk upright bowl retains a full bowl of water and includes its weight',()=>{
 let s=start('bowl');s=act(s,{type:'hold',bottomCm:0});const retained=s.retainedWaterCm3;
 near(retained,bowlWaterCapacity());
 for(const bottomCm of [3,8,12,18,24]){
   s=act(s,{type:'hold',bottomCm});near(s.retainedWaterCm3,retained);conserve(s);
   near(s.externalForce,s.measured.buoyancyN-s.measured.weightN);
 }
 near(s.measured.displacedCm3,0);near(s.externalForce,-(780+retained)*9.8/1000);
 s=act(s,{type:'hold',bottomCm:null});near(s.externalForce,0);near(s.retainedWaterCm3,retained);assert.equal(s.measured.state,'進水沉底');conserve(s);
 s=act(s,{type:'reset'});near(s.retainedWaterCm3,0);assert.equal(s.flooded,false);
});

test('shallow rim immersion cannot draw a full bowl after the outer surface falls to the rim',()=>{
 let s=start('bowl');s=act(s,{type:'hold',bottomCm:7.9});
 near(s.retainedWaterCm3,60);near(s.water.levelCm,15.9);conserve(s);
 s=act(s,{type:'hold',bottomCm:18});near(s.retainedWaterCm3,60);conserve(s);
});

test('adding cargo to a full raised bowl spills to the tank and unloading does not invent water',()=>{
 let s=start('bowl');s=act(s,{type:'hold',bottomCm:0});s=act(s,{type:'hold',bottomCm:18});
 const full=s.retainedWaterCm3,level=s.water.levelCm;
 s=act(s,{type:'load',value:700});near(s.retainedWaterCm3,full-700/7.8);near(s.water.levelCm,level+700/7.8/600);conserve(s);
 const partial=s.retainedWaterCm3;s=act(s,{type:'load',value:0});near(s.retainedWaterCm3,partial);conserve(s);
 s=act(s,{type:'hold',bottomCm:0});near(s.retainedWaterCm3,full);conserve(s);
});

test('all objects synchronize force through dragging and release without a hidden extra hand force',()=>{
 for(const object of Object.values(OBJECTS)){
   let s=start(object.id);
   for(const bottomCm of [0,4,10,18,24]){
     s=act(s,{type:'hold',bottomCm});near(s.externalForce,s.measured.appliedForceN);
     near(s.measured.buoyancyN,s.measured.weightN+s.externalForce);near(s.measured.requiredHandForceN,0);conserve(s);
   }
   s=act(s,{type:'hold',bottomCm:null});near(s.externalForce,0);conserve(s);
 }
});

test('transformation completes above the cup before overlay can be requested',()=>{
 let s=start();s=act(s,{type:'advance'});assert.equal(s.phase,1);
 s=act(s,{type:'advance'});assert.equal(s.phase,2);assert.equal(s.animationReady,false);
 assert.equal(act(s,{type:'advance'}),s,'rapid clicks cannot skip transformation');
 assert.equal(act(s,{type:'animation-complete',phase:3}),s,'stale completion cannot unlock another step');
 s=act(s,{type:'animation-complete',phase:2});assert.equal(s.animationReady,true);
 s=act(s,{type:'advance'});assert.equal(s.phase,3);assert.equal(s.animationReady,false);
 s=act(s,{type:'animation-complete',phase:3});s=act(s,{type:'advance'});assert.equal(s.phase,0);
 near(s.collectedCm3,600);near(s.measured.displacedCm3,600);conserve(s);
});

test('fixed wood has a balancing constraint and changing applied force releases it',()=>{
 let s=start();s=act(s,{type:'hold',bottomCm:4});const bottom=s.measured.bottomCm;
 near(s.measured.buoyancyN,s.measured.weightN+s.externalForce+s.measured.requiredHandForceN);
 s=act(s,{type:'advance'});s=act(s,{type:'advance'});near(s.measured.bottomCm,bottom);
 s=act(s,{type:'force',value:2});assert.equal(s.manualBottomCm,null);assert.equal(s.phase,0);
 near(s.measured.buoyancyN,7.88);conserve(s);
});
