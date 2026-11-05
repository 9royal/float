/** The same steel bowl tilted 60 degrees, with its opening admitting water.
 * Volumes below a horizontal plane integrate circular segments of each original
 * horizontal slice. A small puddle below the lowest inner rim can remain on lift.
 */
import {BOWL_RADIUS_CM,BOWL_HEIGHT_CM,BOWL_BOTTOM_CM,BOWL_INNER_RADIUS_CM,BOWL_CAPACITY_CM3,bowlOuterRadiusAt,bowlInnerRadiusAt} from './bowl.js';
export const BOWL_TILT=Math.PI/3;
const c=Math.cos(BOWL_TILT),s=Math.sin(BOWL_TILT);
export const TILT_MIN_Y=BOWL_HEIGHT_CM*c-Math.hypot(BOWL_HEIGHT_CM*c,BOWL_RADIUS_CM*s);
export const TILT_HEIGHT_CM=BOWL_HEIGHT_CM*c+BOWL_RADIUS_CM*s-TILT_MIN_Y;
export const TILT_CENTER_Z=(2*BOWL_HEIGHT_CM*s+BOWL_RADIUS_CM*c-Math.hypot(BOWL_HEIGHT_CM*s,BOWL_RADIUS_CM*c))/2;
export const TILT_SPILL_HEIGHT_CM=BOWL_HEIGHT_CM*c-BOWL_INNER_RADIUS_CM*s-TILT_MIN_Y;
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
export function tiltPoint(x,y,z){return [x,y*c-z*s-TILT_MIN_Y,y*s+z*c-TILT_CENTER_Z];}
export function circleAbove(radius,cut){
 if(radius<=0||cut>=radius)return 0;
 if(cut<=-radius)return Math.PI*radius*radius;
 return radius*radius*Math.acos(cut/radius)-cut*Math.sqrt(Math.max(0,radius*radius-cut*cut));
}
const TABLE_STEPS=2048,SLICE_STEPS=512;
let table;
function volumes(){
 if(table)return table;
 const slices=Array.from({length:SLICE_STEPS+1},(_,i)=>{
   const y=BOWL_HEIGHT_CM*i/SLICE_STEPS;
   return {base:y*c-TILT_MIN_Y,outer:bowlOuterRadiusAt(y),inner:bowlInnerRadiusAt(y),weight:i===0||i===SLICE_STEPS?1:i%2?4:2};
 });
 const outer=new Float64Array(TABLE_STEPS+1),cavity=new Float64Array(TABLE_STEPS+1);
 for(let j=1;j<=TABLE_STEPS;j++){
   const h=TILT_HEIGHT_CM*j/TABLE_STEPS;let out=0,inside=0;
   for(const q of slices){const cut=(q.base-h)/s;out+=q.weight*circleAbove(q.outer,cut);inside+=q.weight*circleAbove(q.inner,cut);}
   outer[j]=out*BOWL_HEIGHT_CM/(3*SLICE_STEPS);cavity[j]=inside*BOWL_HEIGHT_CM/(3*SLICE_STEPS);
 }
 const outerScale=BOWL_CAPACITY_CM3/outer[TABLE_STEPS],innerScale=(BOWL_CAPACITY_CM3-100)/cavity[TABLE_STEPS];
 for(let i=0;i<=TABLE_STEPS;i++){outer[i]*=outerScale;cavity[i]*=innerScale;}
 table={outer,cavity};return table;
}
function interpolate(values,h){const p=clamp(h/TILT_HEIGHT_CM,0,1)*TABLE_STEPS,i=Math.min(TABLE_STEPS-1,Math.floor(p));return values[i]+(values[i+1]-values[i])*(p-i);}
export const tiltedOuterVolume=h=>interpolate(volumes().outer,h);
export const tiltedCavityVolume=h=>interpolate(volumes().cavity,h);
export const tiltedSteelVolume=h=>Math.max(0,tiltedOuterVolume(h)-tiltedCavityVolume(h));
export const tiltedPuddleVolume=()=>tiltedCavityVolume(TILT_SPILL_HEIGHT_CM);
export function tiltedContents(h,wet){
 const retained=wet&&h<TILT_SPILL_HEIGHT_CM?tiltedPuddleVolume():0;
 const displaced=wet?tiltedSteelVolume(h)+(retained?Math.min(retained,tiltedCavityVolume(h)):0):tiltedOuterVolume(Math.min(h,TILT_SPILL_HEIGHT_CM));
 return {retainedWaterCm3:retained,displacedCm3:displaced,netCm3:displaced-retained};
}
export function tiltedDraftForVolume(volume,kind='steel'){
 let lo=0,hi=TILT_HEIGHT_CM;
 const at=kind==='wet'?h=>tiltedContents(h,true).netCm3:kind==='dry'?h=>tiltedOuterVolume(Math.min(h,TILT_SPILL_HEIGHT_CM)):tiltedSteelVolume;
 if(volume<=at(0))return 0;if(volume>=at(hi))return hi;
 for(let i=0;i<45;i++){const mid=(lo+hi)/2;if(at(mid)<volume)lo=mid;else hi=mid;}
 return (lo+hi)/2;
}
export function tiltedEquilibrium({densityGcm3=1,appliedForceN=0,manualFraction=null,wasSideWet=false}){
 const g=9.8,baseWeight=.780*g,target=(baseWeight+appliedForceN)*1000/(densityGcm3*g);
 const sideWet=wasSideWet||(manualFraction!==null?manualFraction*TILT_HEIGHT_CM>=TILT_SPILL_HEIGHT_CM:target>tiltedOuterVolume(TILT_SPILL_HEIGHT_CM)+1e-8);
 const draftCm=manualFraction!==null?clamp(manualFraction,0,1)*TILT_HEIGHT_CM:tiltedDraftForVolume(target,sideWet?'wet':'dry');
 const contents=tiltedContents(draftCm,sideWet),weightN=baseWeight+contents.retainedWaterCm3*densityGcm3*g/1000;
 const buoyancyN=contents.displacedCm3*densityGcm3*g/1000,residual=weightN+appliedForceN-buoyancyN;
 const bottomReactionN=manualFraction===null&&residual>1e-7?residual:0;
 const state=manualFraction!==null?'手動控制':target<(sideWet?-tiltedPuddleVolume():0)?'向上離水':bottomReactionN>0?'沉底':appliedForceN===0?'漂浮平衡':'受力平衡';
 return {...contents,draftCm,immersionRatio:draftCm/TILT_HEIGHT_CM,buoyancyN,weightN,appliedForceN,bottomReactionN,
   requiredHandForceN:manualFraction!==null?buoyancyN-weightN-appliedForceN:0,totalMassG:weightN/g*1000,
   loadG:0,retainedWaterMassG:contents.retainedWaterCm3*densityGcm3,flooded:false,sideWet,state};
}
export function tiltedWaterForPosition({bottomCm,previouslyCollectedCm3=0,wasSideWet=false,areaCm2=600,lipCm=16}){
 function solve(wet,previous){
   const netAt=level=>tiltedContents(level-bottomCm,wet).netCm3;
   const collectedCm3=Math.max(previous,netAt(lipCm),0);let lo=0,hi=lipCm;
   for(let i=0;i<45;i++){const mid=(lo+hi)/2;if(areaCm2*mid-netAt(mid)+collectedCm3<areaCm2*lipCm)lo=mid;else hi=mid;}
   const levelCm=(lo+hi)/2;
   return {levelCm,collectedCm3,...tiltedContents(levelCm-bottomCm,wet),sideWet:wet};
 }
 let result=solve(wasSideWet,previouslyCollectedCm3);
 if(!wasSideWet&&result.levelCm-bottomCm>=TILT_SPILL_HEIGHT_CM)result=solve(true,result.collectedCm3);
 return {...result,newOverflowCm3:result.collectedCm3-previouslyCollectedCm3};
}
export function tiltedSurfacePoint(u,theta){
 const outer=u<=.5,t=(outer?u:1-u)*Math.PI;
 const radius=(outer?BOWL_RADIUS_CM:BOWL_INNER_RADIUS_CM)*Math.sin(t);
 const y=(outer?0:BOWL_BOTTOM_CM)+(outer?BOWL_HEIGHT_CM:BOWL_HEIGHT_CM-BOWL_BOTTOM_CM)*(1-Math.cos(t));
 const p=tiltPoint(radius*Math.cos(theta),y,radius*Math.sin(theta));p[1]-=TILT_HEIGHT_CM/2;return p;
}

/** Clip a closed triangle surface; translating the volume origin to the cut
 * plane also lets tests independently integrate clipped meshes without a cap. */
export function clipMeshBelow({positions,indices},height){
 const out=[],faces=[],cuts=[];
 const emit=p=>{const i=out.length/3;out.push(...p);return i;};
 for(let i=0;i<indices.length;i+=3){
   const polygon=[];for(let j=0;j<3;j++)polygon.push(Array.from(positions.slice(indices[i+j]*3,indices[i+j]*3+3)));
   const clipped=[];
   for(let j=0;j<3;j++){
     const a=polygon[j],b=polygon[(j+1)%3],ai=a[1]<=height,bi=b[1]<=height;
     if(ai)clipped.push(a);
     if(ai!==bi){const t=(height-a[1])/(b[1]-a[1]),p=[a[0]+(b[0]-a[0])*t,height,a[2]+(b[2]-a[2])*t];clipped.push(p);cuts.push(p);}
   }
   for(let j=1;j<clipped.length-1;j++)faces.push(emit(clipped[0]),emit(clipped[j]),emit(clipped[j+1]));
 }
 const unique=[...new Map(cuts.map(p=>[`${p[0].toFixed(6)},${p[2].toFixed(6)}`,p])).values()];
 if(unique.length>2){
   const center=unique.reduce((a,p)=>[a[0]+p[0]/unique.length,height,a[2]+p[2]/unique.length],[0,height,0]);
   unique.sort((a,b)=>Math.atan2(b[2]-center[2],b[0]-center[0])-Math.atan2(a[2]-center[2],a[0]-center[0]));
   for(let i=0;i<unique.length;i++)faces.push(emit(center),emit(unique[i]),emit(unique[(i+1)%unique.length]));
 }
 return {positions:new Float32Array(out),indices:faces};
}
export function tiltedPuddleMesh(){
 const steps=64,segments=96,points=[];
 for(let i=0;i<=steps;i++){const t=i/steps*Math.PI/2;points.push([BOWL_INNER_RADIUS_CM*Math.sin(t),BOWL_BOTTOM_CM+(BOWL_HEIGHT_CM-BOWL_BOTTOM_CM)*(1-Math.cos(t))]);}
 points.push([0,BOWL_HEIGHT_CM],[0,BOWL_BOTTOM_CM]);
 const positions=[],indices=[];
 for(const [r,y] of points)for(let j=0;j<segments;j++){const t=2*Math.PI*j/segments;positions.push(...tiltPoint(r*Math.cos(t),y,r*Math.sin(t)));}
 for(let i=0;i<points.length-1;i++)for(let j=0;j<segments;j++){const n=(j+1)%segments,a=i*segments+j,b=i*segments+n,q=(i+1)*segments+j,d=(i+1)*segments+n;indices.push(a,q,b,b,q,d);}
 return clipMeshBelow({positions:new Float32Array(positions),indices},TILT_SPILL_HEIGHT_CM);
}
