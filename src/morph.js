/** Equal-volume interpolation between the collected cylinder of liquid and the actual
 * submerged shape. Both meshes use matching horizontal rings/vertex indices.
 * A uniform correction scale restores EXACT enclosed volume for every frame.
 */
import { stoneSectionAtDraft } from './stone.js';
import {clamp} from './physics.js';
import {bowlOuterRadiusAt} from './bowl.js';
export const MORPH_RINGS=25;
export const MORPH_SEGMENTS=24;
function squareRay(theta,side){
 const c=Math.cos(theta),s=Math.sin(theta);
 const r=(side/2)/Math.max(Math.abs(c),Math.abs(s));
 return [r*c,r*s];
}
function section(object,verticalCm,draftCm,theta,index){
 if(object.kind==='stone'){
   const poly=stoneSectionAtDraft(verticalCm);
   return [poly[index][0],poly[index][2]];
 }
 if(object.kind==='bowl'){
   const radius=bowlOuterRadiusAt(verticalCm);
   return [radius*Math.cos(theta),radius*Math.sin(theta)];
 }
 return squareRay(theta,Math.cbrt(object.volumeCm3));
}
function polygonArea(positions,ring){
 let two=0;
 const offset=ring*MORPH_SEGMENTS*3;
 for(let j=0;j<MORPH_SEGMENTS;j++){
   const a=offset+j*3,b=offset+((j+1)%MORPH_SEGMENTS)*3;
   two+=positions[a]*positions[b+2]-positions[b]*positions[a+2];
 }
 return Math.abs(two)/2;
}
function betweenArea(positions,i){
 let two=0;
 for(let j=0;j<MORPH_SEGMENTS;j++){
  const n=(j+1)%MORPH_SEGMENTS;
  const a=(i*MORPH_SEGMENTS+j)*3,b=((i+1)*MORPH_SEGMENTS+j)*3;
  const c=(i*MORPH_SEGMENTS+n)*3,d=((i+1)*MORPH_SEGMENTS+n)*3;
  const x=(positions[a]+positions[b])/2,z=(positions[a+2]+positions[b+2])/2;
  const X=(positions[c]+positions[d])/2,Z=(positions[c+2]+positions[d+2])/2;
  two+=x*Z-X*z;
 }
 return Math.abs(two)/2;
}
export function computeRingVolume(positions){
 let volume=0;
 for(let i=0;i<MORPH_RINGS-1;i++){
   const a=i*MORPH_SEGMENTS*3,b=(i+1)*MORPH_SEGMENTS*3;
   const dy=positions[b+1]-positions[a+1];
   volume+=dy*(polygonArea(positions,i)+4*betweenArea(positions,i)+polygonArea(positions,i+1))/6;
 }
 return volume;
}
export function morphMeshData({object,draftCm,progress,volumeCm3}){
 const p=clamp(progress,0,1), targetDraft=clamp(draftCm,0,object.heightCm);
 // Match the beaker's radius and liquid height. Correct the polygon radius so
 // the displayed source cylinder has the same volume as the collected water.
 const sourceHeight=Math.max(volumeCm3,0.001)/(Math.PI*36);
 const sourceRadius=Math.sqrt(Math.PI*36/(MORPH_SEGMENTS*Math.sin(2*Math.PI/MORPH_SEGMENTS)/2));
 const positions=new Float32Array(MORPH_RINGS*MORPH_SEGMENTS*3+6);
 for(let i=0;i<MORPH_RINGS;i++){
   const u=i/(MORPH_RINGS-1),targetHeight=u*targetDraft;
   for(let j=0;j<MORPH_SEGMENTS;j++){
     const theta=2*Math.PI*j/MORPH_SEGMENTS;
     const sx=sourceRadius*Math.cos(theta),sz=sourceRadius*Math.sin(theta);
     const [tx,tz]=section(object,targetHeight,targetDraft,theta,j);
     const k=3*(i*MORPH_SEGMENTS+j);
     positions[k]=sx+(tx-sx)*p;
     positions[k+1]=(u-.5)*(sourceHeight*(1-p)+targetDraft*p);
     positions[k+2]=sz+(tz-sz)*p;
   }
 }
 positions[positions.length-5]=-(sourceHeight*(1-p)+targetDraft*p)/2;
 positions[positions.length-2]=(sourceHeight*(1-p)+targetDraft*p)/2;
 const indices=[];
 for(let i=0;i<MORPH_RINGS-1;i++)for(let j=0;j<MORPH_SEGMENTS;j++){
   const n=(j+1)%MORPH_SEGMENTS;
   const a=i*MORPH_SEGMENTS+j,b=i*MORPH_SEGMENTS+n,
   c=(i+1)*MORPH_SEGMENTS+j,d=(i+1)*MORPH_SEGMENTS+n;
   indices.push(a,c,b,b,c,d);
 }
 const bottom=(MORPH_RINGS*MORPH_SEGMENTS),top=bottom+1;
 for(let j=0;j<MORPH_SEGMENTS;j++){
   const n=(j+1)%MORPH_SEGMENTS;
   indices.push(bottom,j,n);
   const k=(MORPH_RINGS-1)*MORPH_SEGMENTS;
   indices.push(top,k+n,k+j);
 }
 // Twisted stone sections have non-planar sides. The renderer uses triangles,
 // whose enclosed volume differs slightly from a ruled-ring Simpson integral.
 // Correct the very same closed triangle mesh that is actually displayed.
 const raw=triangleVolume(positions,indices);
 const scale=Math.cbrt(volumeCm3/Math.max(raw,1e-9));
 for(let i=0;i<positions.length;i++)positions[i]*=scale;
 return {positions,indices,actualVolumeCm3:triangleVolume(positions,indices)};
}

function triangleVolume(p,indices){
 let six=0;
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
  six+=p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])+
    p[a+1]*(p[b+2]*p[c]-p[b]*p[c+2])+
    p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]);
 }
 return Math.abs(six/6);
}
