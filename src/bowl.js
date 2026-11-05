/** Upright rounded bowl. All lengths are cm and volumes are cm³.
 * Outer and inner surfaces are half ellipsoids with a calibrated 100 cm³ shell.
 */
export const BOWL_RADIUS_CM=8.5;
export const BOWL_HEIGHT_CM=8;
export const BOWL_BOTTOM_CM=.25;
export const BOWL_STEEL_VOLUME_CM3=100;
export const BOWL_CAPACITY_CM3=2/3*Math.PI*BOWL_RADIUS_CM**2*BOWL_HEIGHT_CM;
export const BOWL_INNER_RADIUS_CM=Math.sqrt((BOWL_CAPACITY_CM3-BOWL_STEEL_VOLUME_CM3)/(2/3*Math.PI*(BOWL_HEIGHT_CM-BOWL_BOTTOM_CM)));
const bounded=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
function ellipsoidRadius(y,r,h){const u=bounded(y/h,0,1);return r*Math.sqrt(2*u-u*u);}
function ellipsoidVolume(y,r,h){const d=bounded(y,0,h);return Math.PI*r*r*(d*d/h-d*d*d/(3*h*h));}
export const bowlOuterRadiusAt=y=>ellipsoidRadius(y,BOWL_RADIUS_CM,BOWL_HEIGHT_CM);
export const bowlInnerRadiusAt=y=>y<BOWL_BOTTOM_CM?0:ellipsoidRadius(y-BOWL_BOTTOM_CM,BOWL_INNER_RADIUS_CM,BOWL_HEIGHT_CM-BOWL_BOTTOM_CM);
export const bowlOuterVolumeAt=y=>ellipsoidVolume(y,BOWL_RADIUS_CM,BOWL_HEIGHT_CM);
export const bowlCavityVolumeAt=y=>ellipsoidVolume(y-BOWL_BOTTOM_CM,BOWL_INNER_RADIUS_CM,BOWL_HEIGHT_CM-BOWL_BOTTOM_CM);
export const bowlCargoVolume=loadG=>bounded(loadG,0,1500)/7.8;
export function bowlCargoBottomCm(loadG){
 const side=Math.cbrt(bowlCargoVolume(loadG)),radius=side/Math.sqrt(2);
 return BOWL_BOTTOM_CM+(BOWL_HEIGHT_CM-BOWL_BOTTOM_CM)*(1-Math.sqrt(Math.max(0,1-(radius/BOWL_INNER_RADIUS_CM)**2)));
}
export function bowlCargoBelow(y,loadG=0){
 const volume=bowlCargoVolume(loadG),side=Math.cbrt(volume);
 return side>0?volume*bounded((y-bowlCargoBottomCm(loadG))/side,0,1):0;
}
export const bowlWaterCapacity=(loadG=0)=>bowlCavityVolumeAt(BOWL_HEIGHT_CM)-bowlCargoVolume(loadG);
export const bowlWaterBelow=(y,loadG=0)=>Math.max(0,bowlCavityVolumeAt(y)-bowlCargoBelow(y,loadG));
export function bowlWaterHeight(volume,loadG=0){
 if(volume<=0)return BOWL_BOTTOM_CM;
 let lo=BOWL_BOTTOM_CM,hi=BOWL_HEIGHT_CM;
 for(let i=0;i<45;i++){const mid=(lo+hi)/2;if(bowlWaterBelow(mid,loadG)<volume)lo=mid;else hi=mid;}
 return (lo+hi)/2;
}
export function bowlProfile(steps=96){
 const points=[];
 for(let i=0;i<=steps;i++){const t=i/steps*Math.PI/2;points.push([BOWL_RADIUS_CM*Math.sin(t),BOWL_HEIGHT_CM*(1-Math.cos(t))]);}
 for(let i=steps;i>=0;i--){const t=i/steps*Math.PI/2;points.push([BOWL_INNER_RADIUS_CM*Math.sin(t),BOWL_BOTTOM_CM+(BOWL_HEIGHT_CM-BOWL_BOTTOM_CM)*(1-Math.cos(t))]);}
 points.push([0,0]);
 return points;
}
export function bowlWaterProfile(volume,loadG=0,steps=64){
 const top=bowlWaterHeight(volume,loadG),points=[];
 for(let i=0;i<=steps;i++){const y=BOWL_BOTTOM_CM+(top-BOWL_BOTTOM_CM)*i/steps;points.push([bowlInnerRadiusAt(y),y]);}
 points.push([0,top],[0,BOWL_BOTTOM_CM]);
 return points;
}
