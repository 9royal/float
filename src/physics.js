/** Buoyancy Lab — static-state engine. Units: density g/cm³, volume cm³, force N.
 * Positive external force points downward. g = 9.8 m/s².
 * The model explicitly distinguishes current immersed volume from collected overflow.
 */
import { stoneDisplacedByDraft, stoneDraftForVolume, stoneHeightCm, stoneTotalVolumeCm3 } from './stone.js';
export const G = 9.8;
export const INITIAL_LEVEL_CM = 16;
export const TANK_AREA_CM2 = 600; // 30 × 20 cm horizontal tank area
export const BOWL_RADIUS_CM = 7;
export const BOWL_HEIGHT_CM = 8;
export const BOWL_BOTTOM_CM = 0.25;
export const BOWL_INNER_RADIUS_CM = Math.sqrt((Math.PI*BOWL_RADIUS_CM**2*BOWL_HEIGHT_CM-100)/(Math.PI*(BOWL_HEIGHT_CM-BOWL_BOTTOM_CM)));
export const BOWL_CAPACITY_CM3 = Math.PI*BOWL_RADIUS_CM**2*BOWL_HEIGHT_CM;
export const OBJECTS = Object.freeze({
  wood: { id:'wood',label:'木塊',density:0.6,massG:600,volumeCm3:1000,heightCm:10,kind:'cube',maxForce:6 },
  iron: { id:'iron',label:'鐵塊',density:7.8,massG:7800,volumeCm3:1000,heightCm:10,kind:'cube',maxForce:90 },
  stone: { id:'stone',label:'石頭',density:2.6,massG:2600,volumeCm3:stoneTotalVolumeCm3,heightCm:stoneHeightCm,kind:'stone',maxForce:35 },
  bowl: { id:'bowl',label:'鐵碗',density:7.8,massG:780,volumeCm3:BOWL_CAPACITY_CM3,heightCm:BOWL_HEIGHT_CM,kind:'bowl',steelVolumeCm3:100,maxForce:18 }
});
export const clamp = (v,lo,hi)=>Math.min(hi,Math.max(lo,v));
export const weightN = massG => massG*G/1000;
export const buoyancyN = (volCm3,densityGcm3)=>volCm3*densityGcm3*G/1000;
export const volumeForDraft = (object,draftCm)=>{
  const d=clamp(draftCm,0,object.heightCm);
  if(object.kind==='stone')return stoneDisplacedByDraft(d);
  return object.volumeCm3*d/object.heightCm;
};
export const draftForVolume = (object,volCm3)=>{
  if(object.kind==='stone')return stoneDraftForVolume(volCm3);
  return object.heightCm*clamp(volCm3/object.volumeCm3,0,1);
};
/** The free surface intersects the object, or the body is resting at the bottom.
 * In bowl flooding, water enters the open vessel: only solid steel and solid cargo exclude water.
 */
export function equilibrium({object,densityGcm3=1,appliedForceN=0,manualFraction=null,loadG=0,wasFlooded=false}){
  if(!object||!Number.isFinite(densityGcm3)||densityGcm3<=0||!Number.isFinite(appliedForceN)||!Number.isFinite(loadG))throw new Error('Invalid object, density or force');
  const cargoMass=object.kind==='bowl'?clamp(loadG,0,1500):0;
  const totalMass=object.massG+cargoMass;
  const weight=weightN(totalMass);
  const targetVol=(weight+appliedForceN)*1000/(densityGcm3*G);
  const flooded=object.kind==='bowl'&&(wasFlooded||(manualFraction!==null?manualFraction>=1-1e-9:targetVol>object.volumeCm3+1e-8));
  // When flooded and sunk, the interior is no longer an excluded-water volume.
  const floodedExcluded=object.kind==='bowl'?object.steelVolumeCm3+cargoMass/7.8:0;
  const effectiveMax=flooded?floodedExcluded:object.volumeCm3;
  const displaced=manualFraction===null?
    clamp(targetVol,0,effectiveMax):
    (flooded?floodedVolumeForDraft(object.heightCm*clamp(manualFraction,0,1),cargoMass):volumeForDraft(object,object.heightCm*clamp(manualFraction,0,1)));
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
  const draftCm=manualFraction!==null?object.heightCm*clamp(manualFraction,0,1):flooded?floodedDraftForVolume(displaced,cargoMass):draftForVolume(object,displaced);
  return {
    displacedCm3:displaced,
    immersionRatio:object.heightCm===0?0:draftCm/object.heightCm,
    draftCm, buoyancyN:buoyancy, weightN:weight,
    appliedForceN,bottomReactionN:bottomReaction,requiredHandForceN:handForce,
    totalMassG:totalMass, loadG:cargoMass, flooded, state
  };
}
/** A flooded bowl is a communicating, drained shell in this static teaching model.
 * Its steel shell and steel cargo, rather than its open cavity, exclude liquid.
 */
export function floodedVolumeForDraft(draftCm,loadG=0){
  const d=clamp(draftCm,0,BOWL_HEIGHT_CM);
  const outer=Math.PI*BOWL_RADIUS_CM**2*d;
  const cavity=Math.PI*BOWL_INNER_RADIUS_CM**2*Math.max(0,d-BOWL_BOTTOM_CM);
  const cargoVolume=clamp(loadG,0,1500)/7.8;
  const side=Math.cbrt(cargoVolume);
  const cargo=side>0?cargoVolume*clamp((d-BOWL_BOTTOM_CM)/side,0,1):0;
  return outer-cavity+cargo;
}
function floodedDraftForVolume(volumeCm3,loadG){
  if(volumeCm3<=0)return 0;
  if(volumeCm3>=floodedVolumeForDraft(BOWL_HEIGHT_CM,loadG)-1e-8)return BOWL_HEIGHT_CM;
  let lo=0,hi=BOWL_HEIGHT_CM;
  for(let i=0;i<45;i++){
    const mid=(lo+hi)/2;
    if(floodedVolumeForDraft(mid,loadG)<volumeCm3)lo=mid;else hi=mid;
  }
  return (lo+hi)/2;
}
/** Solve the waterline and actual immersed volume together while the body is held
 * at an absolute height. This allows motion at constant volume below the surface.
 */
export function waterForPosition({object,bottomCm,previouslyCollectedCm3=0,flooded=false,loadG=0}){
  const excludedAt=level=>flooded?floodedVolumeForDraft(level-bottomCm,loadG):volumeForDraft(object,level-bottomCm);
  const atLip=excludedAt(INITIAL_LEVEL_CM);
  const collectedCm3=Math.max(previouslyCollectedCm3,atLip);
  let lo=0,hi=INITIAL_LEVEL_CM;
  for(let i=0;i<45;i++){
    const mid=(lo+hi)/2;
    const conserved=TANK_AREA_CM2*mid-excludedAt(mid)+collectedCm3;
    if(conserved<TANK_AREA_CM2*INITIAL_LEVEL_CM)lo=mid;else hi=mid;
  }
  const levelCm=(lo+hi)/2;
  return {levelCm,collectedCm3,displacedCm3:excludedAt(levelCm),newOverflowCm3:collectedCm3-previouslyCollectedCm3};
}
/** Volume conservation of overflow tank starting at its lip. Collected water never returns.
 * When displacing less than past maximum, surface falls below the lip accordingly.
 */
export function nextOverflow({previouslyCollectedCm3,displacedCm3,areaCm2=TANK_AREA_CM2,lipCm=INITIAL_LEVEL_CM}){
  if(!Number.isFinite(areaCm2)||areaCm2<=0||!Number.isFinite(previouslyCollectedCm3)||!Number.isFinite(displacedCm3))throw new Error('Invalid overflow parameters');
  const prior=Math.max(0,previouslyCollectedCm3);
  const collectedCm3=Math.max(prior,Math.max(0,displacedCm3));
  const levelCm=clamp(lipCm-(collectedCm3-displacedCm3)/areaCm2,0,lipCm);
  return {collectedCm3,levelCm,newOverflowCm3:collectedCm3-prior};
}
export const round = (v,digits=1)=>Math.round((v+Number.EPSILON)*10**digits)/10**digits;
