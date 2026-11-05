/** Buoyancy Lab — static-state engine. Units: density g/cm³, volume cm³, force N.
 * Positive external force points downward. g = 9.8 m/s².
 * The model explicitly distinguishes current immersed volume from collected overflow.
 */
import { stoneDisplacedByDraft, stoneDraftForVolume, stoneHeightCm, stoneTotalVolumeCm3 } from './stone.js';
import {BOWL_CAPACITY_CM3,BOWL_HEIGHT_CM,bowlOuterVolumeAt,bowlCavityVolumeAt,bowlCargoBelow,bowlWaterCapacity} from './bowl.js';
import {TILT_HEIGHT_CM,tiltedSteelVolume,tiltedDraftForVolume,tiltedEquilibrium} from './tilted-bowl.js';
export {BOWL_RADIUS_CM,BOWL_HEIGHT_CM,BOWL_BOTTOM_CM,BOWL_INNER_RADIUS_CM,BOWL_CAPACITY_CM3} from './bowl.js';
export const G = 9.8;
export const INITIAL_LEVEL_CM = 16;
export const TANK_AREA_CM2 = 600; // 30 × 20 cm horizontal tank area
export const OBJECTS = Object.freeze({
  wood: { id:'wood',label:'木塊',density:0.6,massG:600,volumeCm3:1000,heightCm:10,kind:'cube',maxForce:6 },
  iron: { id:'iron',label:'鐵塊',density:7.8,massG:7800,volumeCm3:1000,heightCm:10,kind:'cube',maxForce:90 },
  stone: { id:'stone',label:'石頭',density:2.6,massG:2600,volumeCm3:stoneTotalVolumeCm3,heightCm:stoneHeightCm,kind:'stone',maxForce:35 },
  bowl: { id:'bowl',label:'鐵碗',density:7.8,massG:780,volumeCm3:BOWL_CAPACITY_CM3,heightCm:BOWL_HEIGHT_CM,kind:'bowl',steelVolumeCm3:100,maxForce:35 },
  bowlSide: { id:'bowlSide',label:'立鐵碗',density:7.8,massG:780,volumeCm3:100,heightCm:TILT_HEIGHT_CM,kind:'tilted-bowl',steelVolumeCm3:100,maxForce:10 }
});
export const clamp = (v,lo,hi)=>Math.min(hi,Math.max(lo,v));
export const weightN = massG => massG*G/1000;
export const buoyancyN = (volCm3,densityGcm3)=>volCm3*densityGcm3*G/1000;
export const volumeForDraft = (object,draftCm)=>{
  const d=clamp(draftCm,0,object.heightCm);
  if(object.kind==='stone')return stoneDisplacedByDraft(d);
  if(object.kind==='bowl')return bowlOuterVolumeAt(d);
  if(object.kind==='tilted-bowl')return tiltedSteelVolume(d);
  return object.volumeCm3*d/object.heightCm;
};
export const draftForVolume = (object,volCm3)=>{
  if(object.kind==='stone')return stoneDraftForVolume(volCm3);
  if(object.kind==='tilted-bowl')return tiltedDraftForVolume(volCm3);
  if(object.kind==='bowl'){
    const volume=clamp(volCm3,0,object.volumeCm3);let lo=0,hi=object.heightCm;
    for(let i=0;i<45;i++){const mid=(lo+hi)/2;if(bowlOuterVolumeAt(mid)<volume)lo=mid;else hi=mid;}
    return (lo+hi)/2;
  }
  return object.heightCm*clamp(volCm3/object.volumeCm3,0,1);
};
/** The free surface intersects the object, or the body is resting at the bottom.
 * A flooded upright bowl and its retained water form one system: the water's
 * mass is included in weight and the outer submerged hull supplies buoyancy.
 */
export function equilibrium({object,densityGcm3=1,appliedForceN=0,manualFraction=null,loadG=0,wasFlooded=false,retainedWaterCm3,allowFlooding=true,wasSideWet=false}){
  if(!object||!Number.isFinite(densityGcm3)||densityGcm3<=0||!Number.isFinite(appliedForceN)||!Number.isFinite(loadG))throw new Error('Invalid object, density or force');
  if(object.kind==='tilted-bowl')return tiltedEquilibrium({densityGcm3,appliedForceN,manualFraction,wasSideWet});
  const cargoMass=object.kind==='bowl'?clamp(loadG,0,1500):0;
  const dryMass=object.massG+cargoMass;
  const dryTarget=(weightN(dryMass)+appliedForceN)*1000/(densityGcm3*G);
  const flooded=object.kind==='bowl'&&(wasFlooded||(allowFlooding&&(manualFraction!==null?manualFraction>=1-1e-9:dryTarget>object.volumeCm3+1e-8)));
  const retained=flooded?clamp(!wasFlooded&&allowFlooding?bowlWaterCapacity(cargoMass):(retainedWaterCm3??bowlWaterCapacity(cargoMass)),0,bowlWaterCapacity(cargoMass)):0;
  const retainedMass=retained*densityGcm3;
  const totalMass=dryMass+retainedMass;
  const weight=weightN(totalMass);
  const targetVol=(weight+appliedForceN)*1000/(densityGcm3*G);
  const displaced=manualFraction===null?
    clamp(targetVol,0,object.volumeCm3):volumeForDraft(object,object.heightCm*clamp(manualFraction,0,1));
  const buoyancy=buoyancyN(displaced,densityGcm3);
  const residual=weight+appliedForceN-buoyancy;
  const bottomReaction=manualFraction===null&&residual>1e-7?residual:0;
  const handForce=manualFraction!==null?buoyancy-weight-appliedForceN:0;
  let state;
  if(manualFraction!==null)state='手動控制';
  else if(targetVol<0)state='向上離水';
  else if(flooded)state=residual>1e-7?'進水沉底':'進水平衡';
  else if(targetVol>object.volumeCm3+1e-7)state='沉底';
  else state=appliedForceN===0?'漂浮平衡':'受力平衡';
  const draftCm=manualFraction!==null?object.heightCm*clamp(manualFraction,0,1):draftForVolume(object,displaced);
  return {
    displacedCm3:displaced,
    immersionRatio:object.heightCm===0?0:draftCm/object.heightCm,
    draftCm, buoyancyN:buoyancy, weightN:weight,
    appliedForceN,bottomReactionN:bottomReaction,requiredHandForceN:handForce,
    totalMassG:totalMass, loadG:cargoMass, retainedWaterCm3:retained,retainedWaterMassG:retainedMass,flooded, state
  };
}
/** Material volume only, useful for checking the calibrated shell and cargo. */
export function floodedVolumeForDraft(draftCm,loadG=0){
  const d=clamp(draftCm,0,BOWL_HEIGHT_CM);
  return bowlOuterVolumeAt(d)-bowlCavityVolumeAt(d)+bowlCargoBelow(d,loadG);
}
/** Solve the waterline and actual immersed volume together while the body is held
 * at an absolute height. This allows motion at constant volume below the surface.
 */
export function waterForPosition({object,bottomCm,previouslyCollectedCm3=0,retainedWaterCm3=0}){
  const excludedAt=level=>volumeForDraft(object,level-bottomCm);
  const atLip=excludedAt(INITIAL_LEVEL_CM);
  const collectedCm3=Math.max(previouslyCollectedCm3,atLip-retainedWaterCm3,0);
  let lo=0,hi=INITIAL_LEVEL_CM;
  for(let i=0;i<45;i++){
    const mid=(lo+hi)/2;
    const conserved=TANK_AREA_CM2*mid-excludedAt(mid)+collectedCm3+retainedWaterCm3;
    if(conserved<TANK_AREA_CM2*INITIAL_LEVEL_CM)lo=mid;else hi=mid;
  }
  const levelCm=(lo+hi)/2;
  return {levelCm,collectedCm3,displacedCm3:excludedAt(levelCm),newOverflowCm3:collectedCm3-previouslyCollectedCm3};
}
/** Volume conservation of overflow tank starting at its lip. Collected water never returns.
 * When displacing less than past maximum, surface falls below the lip accordingly.
 */
export function nextOverflow({previouslyCollectedCm3,displacedCm3,retainedWaterCm3=0,areaCm2=TANK_AREA_CM2,lipCm=INITIAL_LEVEL_CM}){
  if(!Number.isFinite(areaCm2)||areaCm2<=0||!Number.isFinite(previouslyCollectedCm3)||!Number.isFinite(displacedCm3))throw new Error('Invalid overflow parameters');
  const prior=Math.max(0,previouslyCollectedCm3);
  const collectedCm3=Math.max(prior,Math.max(0,displacedCm3-retainedWaterCm3));
  const levelCm=clamp(lipCm-(collectedCm3+retainedWaterCm3-displacedCm3)/areaCm2,0,lipCm);
  return {collectedCm3,levelCm,newOverflowCm3:collectedCm3-prior};
}
export const round = (v,digits=1)=>Math.round((v+Number.EPSILON)*10**digits)/10**digits;
export function canCompareVolumes(object,measured,collectedCm3,started=true){
 return started&&!measured.flooded&&measured.displacedCm3>0&&Math.abs(collectedCm3-measured.displacedCm3)<.25&&
   (object.kind!=='tilted-bowl'||(measured.sideWet&&measured.draftCm>=object.heightCm-1e-5&&measured.retainedWaterCm3<1e-6));
}
