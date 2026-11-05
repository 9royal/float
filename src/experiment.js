import {OBJECTS,INITIAL_LEVEL_CM,clamp,equilibrium,nextOverflow,waterForPosition} from './physics.js';

/** Each user action commits the physical state and its overflow history together.
 * No render effect can refill the cup or omit collection after changing liquid.
 */
export function createExperiment(overrides={}){
  return settle({objectId:'wood',density:1,externalForce:0,loadG:0,started:false,
    manualBottomCm:null,collectedCm3:0,flooded:false,phase:0,rotation:0,flowPulse:0,...overrides});
}

function settle(state){
  const object=OBJECTS[state.objectId];
  const options={object,densityGcm3:state.density,appliedForceN:state.externalForce,loadG:state.loadG,wasFlooded:state.flooded};
  let measured=equilibrium(options);
  let collected=state.collectedCm3;
  let water;
  if(!state.started){
    return {...state,flooded:false,measured:{...measured,bottomCm:0},water:{levelCm:INITIAL_LEVEL_CM,collectedCm3:0,newOverflowCm3:0},collectedCm3:0};
  }
  if(state.manualBottomCm!==null){
    water=waterForPosition({object,bottomCm:state.manualBottomCm,previouslyCollectedCm3:collected,
      flooded:state.flooded,loadG:state.loadG});
    const fraction=clamp((water.levelCm-state.manualBottomCm)/object.heightCm,0,1);
    measured=equilibrium({...options,manualFraction:fraction});
    if(measured.flooded&&!state.flooded){
      // The dry hull first reaches its rim before the open cavity fills.
      collected=Math.max(collected,object.volumeCm3);
      water=waterForPosition({object,bottomCm:state.manualBottomCm,previouslyCollectedCm3:collected,flooded:true,loadG:state.loadG});
      measured=equilibrium({...options,wasFlooded:true,manualFraction:clamp((water.levelCm-state.manualBottomCm)/object.heightCm,0,1)});
    }
    measured={...measured,bottomCm:state.manualBottomCm};
  }else{
    if(measured.flooded&&!state.flooded)collected=Math.max(collected,object.volumeCm3);
    water=nextOverflow({previouslyCollectedCm3:collected,displacedCm3:measured.displacedCm3});
    let bottomCm=Math.max(0,water.levelCm-measured.draftCm);
    if(measured.bottomReactionN>0)bottomCm=0;
    // At exact neutral suspension a fully immersed body may stay at any depth.
    if(measured.displacedCm3>=object.volumeCm3-1e-6&&measured.bottomReactionN===0&&state.measured?.bottomCm!==undefined){
      bottomCm=clamp(state.measured.bottomCm,0,bottomCm);
    }
    measured={...measured,bottomCm};
  }
  return {...state,measured,water,collectedCm3:water.collectedCm3,flooded:measured.flooded,
    flowPulse:state.flowPulse+(water.collectedCm3>state.collectedCm3+0.05?1:0)};
}

export function experimentReducer(state,action){
  switch(action.type){
    case 'reset':return createExperiment({objectId:state.objectId,density:state.density});
    case 'object':return OBJECTS[action.id]&&action.id!==state.objectId?createExperiment({objectId:action.id,density:state.density}):state;
    case 'density':{
      const density=Number(action.value);
      if(!Number.isFinite(density)||density<1||density>1.2||density===state.density)return state;
      return settle({...state,density,collectedCm3:0,flooded:false,manualBottomCm:null,phase:0,flowPulse:0});
    }
    case 'force':{
      const value=Number(action.value);
      if(!Number.isFinite(value))return state;
      return settle({...state,externalForce:clamp(value,-OBJECTS[state.objectId].maxForce,OBJECTS[state.objectId].maxForce),manualBottomCm:null,phase:0});
    }
    case 'load':{
      const value=Number(action.value);
      if(!Number.isFinite(value))return state;
      return settle({...state,loadG:clamp(value,0,1000),manualBottomCm:null,phase:0});
    }
    case 'hold':{
      if(!state.started)return state;
      if(action.bottomCm!==null&&!Number.isFinite(action.bottomCm))return state;
      return settle({...state,manualBottomCm:action.bottomCm===null?null:clamp(action.bottomCm,0,24),phase:0});
    }
    case 'rotate':return state.objectId==='stone'?{...state,rotation:action.value,phase:0}:state;
    case 'advance':{
      if(!state.started)return settle({...state,started:true});
      const valid=!state.flooded&&state.measured.displacedCm3>0&&Math.abs(state.collectedCm3-state.measured.displacedCm3)<0.25;
      return {...state,phase:state.phase===1&&!valid?0:(state.phase+1)%3};
    }
    default:return state;
  }
}
