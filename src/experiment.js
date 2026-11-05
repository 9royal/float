import {OBJECTS,INITIAL_LEVEL_CM,TANK_AREA_CM2,clamp,equilibrium,nextOverflow,waterForPosition,canCompareVolumes} from './physics.js';
import {bowlWaterCapacity} from './bowl.js';
import {TILT_SPILL_HEIGHT_CM,tiltedOuterVolume,tiltedWaterForPosition} from './tilted-bowl.js';

/** Each user action commits the physical state and its overflow history together.
 * No render effect can refill the cup or omit collection after changing liquid.
 */
export function createExperiment(overrides={}){
  return settle({objectId:'wood',density:1,externalForce:0,loadG:0,started:false,
    manualBottomCm:null,collectedCm3:0,retainedWaterCm3:0,flooded:false,sideWet:false,viewRevision:0,phase:0,animationReady:true,rotation:0,flowPulse:0,...overrides});
}

function settle(state){
  const object=OBJECTS[state.objectId];
  if(object.kind==='tilted-bowl')return settleTilted(state,object);
  const options={object,densityGcm3:state.density,appliedForceN:state.externalForce,loadG:state.loadG,wasFlooded:state.flooded,retainedWaterCm3:state.retainedWaterCm3};
  let measured=equilibrium(options);
  let collected=state.collectedCm3;
  let retained=object.kind==='bowl'?Math.min(state.retainedWaterCm3,bowlWaterCapacity(state.loadG)):0;
  let flooded=state.flooded,externalForce=state.externalForce,water;
  if(!state.started){
    return {...state,flooded:false,retainedWaterCm3:0,measured:{...measured,bottomCm:0},water:{levelCm:INITIAL_LEVEL_CM,collectedCm3:0,newOverflowCm3:0},collectedCm3:0};
  }
  // Water can enter only while the upright rim is below the outer surface.
  // Intake stops if filling lowers the tank surface to the rim. A bowl lifted
  // above the surface keeps its water; cargo can spill excess back into the tank.
  const intake=(bottom,level,cup,current)=>object.kind!=='bowl'||level<=bottom+object.heightCm+1e-8?current:
    clamp(TANK_AREA_CM2*(INITIAL_LEVEL_CM-bottom-object.heightCm)+object.volumeCm3-cup,current,bowlWaterCapacity(state.loadG));
  if(state.manualBottomCm!==null){
    water=waterForPosition({object,bottomCm:state.manualBottomCm,previouslyCollectedCm3:collected,retainedWaterCm3:retained});
    const incoming=intake(state.manualBottomCm,water.levelCm,water.collectedCm3,retained);
    if(incoming>retained+1e-8){
      retained=incoming;flooded=true;
      water=waterForPosition({object,bottomCm:state.manualBottomCm,previouslyCollectedCm3:water.collectedCm3,retainedWaterCm3:retained});
    }
    measured=equilibrium({...options,wasFlooded:flooded,retainedWaterCm3:retained,allowFlooding:false,manualFraction:clamp((water.levelCm-state.manualBottomCm)/object.heightCm,0,1)});
    externalForce=measured.buoyancyN-measured.weightN;
    measured={...measured,bottomCm:state.manualBottomCm,appliedForceN:externalForce,requiredHandForceN:0};
  }else{
    flooded=measured.flooded;retained=measured.retainedWaterCm3;
    if(flooded&&!state.flooded)collected=Math.max(collected,object.volumeCm3);
    for(let i=0;i<3;i++){
      water=nextOverflow({previouslyCollectedCm3:collected,displacedCm3:measured.displacedCm3,retainedWaterCm3:retained});
      let bottomCm=Math.max(0,water.levelCm-measured.draftCm);
      if(measured.bottomReactionN>0)bottomCm=0;
      if(measured.displacedCm3>=object.volumeCm3-1e-6&&measured.bottomReactionN===0&&state.measured?.bottomCm!==undefined){bottomCm=clamp(state.measured.bottomCm,0,bottomCm);}
      measured={...measured,bottomCm};
      const incoming=intake(bottomCm,water.levelCm,water.collectedCm3,retained);
      if(incoming<=retained+1e-8)break;
      retained=incoming;flooded=true;collected=water.collectedCm3;
      measured=equilibrium({...options,wasFlooded:true,retainedWaterCm3:retained});
    }
  }
  return {...state,measured,water,externalForce,retainedWaterCm3:retained,collectedCm3:water.collectedCm3,flooded,
    flowPulse:state.flowPulse+(water.collectedCm3>state.collectedCm3+0.05?1:0)};
}

function settleTilted(state,object){
 const options={object,densityGcm3:state.density,appliedForceN:state.externalForce,wasSideWet:state.sideWet};
 let measured=equilibrium(options),water,externalForce=state.externalForce;
 if(!state.started)return {...state,measured:{...measured,bottomCm:0},water:{levelCm:INITIAL_LEVEL_CM,collectedCm3:0,newOverflowCm3:0},sideWet:false,flooded:false,retainedWaterCm3:0,collectedCm3:0};
 if(state.manualBottomCm!==null){
   water=tiltedWaterForPosition({bottomCm:state.manualBottomCm,previouslyCollectedCm3:state.collectedCm3,wasSideWet:state.sideWet});
   measured=equilibrium({...options,wasSideWet:water.sideWet,manualFraction:clamp((water.levelCm-state.manualBottomCm)/object.heightCm,0,1)});
   externalForce=measured.buoyancyN-measured.weightN;
   measured={...measured,bottomCm:state.manualBottomCm,appliedForceN:externalForce,requiredHandForceN:0};
 }else{
   const prior=measured.sideWet&&!state.sideWet?Math.max(state.collectedCm3,tiltedOuterVolume(TILT_SPILL_HEIGHT_CM)):state.collectedCm3;
   water=nextOverflow({previouslyCollectedCm3:prior,displacedCm3:measured.displacedCm3,retainedWaterCm3:measured.retainedWaterCm3});
   let bottomCm=measured.bottomReactionN>0?0:Math.max(0,water.levelCm-measured.draftCm);
   if(measured.displacedCm3>=100-1e-6&&measured.bottomReactionN===0&&state.measured?.bottomCm!==undefined)bottomCm=clamp(state.measured.bottomCm,0,bottomCm);
   measured={...measured,bottomCm};
 }
 return {...state,measured,water,externalForce,sideWet:measured.sideWet,flooded:false,retainedWaterCm3:measured.retainedWaterCm3,collectedCm3:water.collectedCm3,
   flowPulse:state.flowPulse+(water.collectedCm3>state.collectedCm3+.05?1:0)};
}

export function experimentReducer(state,action){
  switch(action.type){
    case 'reset':return createExperiment({objectId:state.objectId,density:state.density,viewRevision:state.viewRevision+1});
    case 'object':return OBJECTS[action.id]&&action.id!==state.objectId?createExperiment({objectId:action.id,density:state.density,viewRevision:state.viewRevision+1}):state;
    case 'density':{
      const density=Number(action.value);
      if(!Number.isFinite(density)||density<1||density>1.2||density===state.density)return state;
      return settle({...state,density,externalForce:state.manualBottomCm!==null?0:state.externalForce,collectedCm3:0,retainedWaterCm3:0,flooded:false,sideWet:false,manualBottomCm:null,phase:0,flowPulse:0});
    }
    case 'force':{
      const value=Number(action.value);
      if(!Number.isFinite(value))return state;
      return settle({...state,externalForce:clamp(value,-OBJECTS[state.objectId].maxForce,OBJECTS[state.objectId].maxForce),manualBottomCm:null,phase:0});
    }
    case 'load':{
      const value=Number(action.value);
      if(!Number.isFinite(value))return state;
      return settle({...state,loadG:clamp(value,0,1000),phase:0});
    }
    case 'hold':{
      if(!state.started)return state;
      if(action.bottomCm!==null&&!Number.isFinite(action.bottomCm))return state;
      if(action.bottomCm===null&&state.manualBottomCm===null)return state;
      return settle({...state,externalForce:action.bottomCm===null?0:state.externalForce,manualBottomCm:action.bottomCm===null?null:clamp(action.bottomCm,0,24),phase:0});
    }
    case 'rotate':return state.objectId==='stone'?{...state,rotation:action.value,phase:0}:state;
    case 'animation-complete':return state.phase===action.phase&&!state.animationReady?{...state,animationReady:true}:state;
    case 'advance':{
      if(!state.started)return settle({...state,started:true});
      if(state.phase>=2&&!state.animationReady)return state;
      const valid=canCompareVolumes(OBJECTS[state.objectId],state.measured,state.collectedCm3,state.started);
      const phase=state.phase===1&&!valid?0:(state.phase+1)%4;
      return {...state,phase,animationReady:phase<2};
    }
    default:return state;
  }
}
