/** Deterministic, non-self-intersecting irregular stone.
 * Coordinates and volumes are in cm / cm³; display converts cm to world units.
 * Each horizontal polygon cross-section is linearly interpolated between rings.
 * By integrating polygon area (quadratic in interpolation t) using Simpson's rule,
 * submerged and total volumes are mutually consistent to floating-point precision.
 */
export const STONE_TARGET_CM3 = 1000;
const RINGS = 32;
const SEGMENTS = 24;
const HALF_HEIGHT_CM = 6.65;

function rawRings(){
  const rings=[];
  for(let i=0;i<=RINGS;i++){
    const u=i/RINGS;
    const thetaFactor=Math.pow(Math.max(0,Math.sin(Math.PI*u)),0.62);
    const vertices=[];
    for(let j=0;j<SEGMENTS;j++){
      const theta=j*Math.PI*2/SEGMENTS;
      const bump=1+0.095*Math.sin(3*theta+1.7*u)+0.082*Math.sin(5*theta-2.5*u)+0.055*Math.cos(7*theta+u*4.1);
      vertices.push([
        6.45*thetaFactor*bump*Math.cos(theta),
        (u*2-1)*HALF_HEIGHT_CM,
        5.6*thetaFactor*(1+0.14*Math.cos(4*theta+u*3.1))*Math.sin(theta)
      ]);
    }
    rings.push(vertices);
  }
  return rings;
}
function polygonArea(ring){
  let twice=0;
  for(let j=0;j<ring.length;j++){
    const a=ring[j], b=ring[(j+1)%ring.length];
    twice += a[0]*b[2]-b[0]*a[2];
  }
  return Math.abs(twice)/2;
}
function lerpRing(a,b,t){
  return a.map((v,j)=>[
    v[0]+(b[j][0]-v[0])*t,
    v[1]+(b[j][1]-v[1])*t,
    v[2]+(b[j][2]-v[2])*t
  ]);
}
function intervalVolume(a,b,t){
  if(t<=0) return 0;
  const h=(b[0][1]-a[0][1])*t;
  const A0=polygonArea(a), Am=polygonArea(lerpRing(a,b,t/2)), A1=polygonArea(lerpRing(a,b,t));
  return h*(A0+4*Am+A1)/6;
}
const unscaled=rawRings();
const rawVolume=unscaled.slice(0,-1).reduce((sum,ring,i)=>sum+intervalVolume(ring,unscaled[i+1],1),0);
const scale=Math.cbrt(STONE_TARGET_CM3/rawVolume);
export const stoneRings=unscaled.map(r=>r.map(v=>v.map(x=>x*scale)));
export const stoneHeightCm=(stoneRings.at(-1)[0][1]-stoneRings[0][0][1]);
export const stoneTotalVolumeCm3=stoneRings.slice(0,-1).reduce((sum,ring,i)=>sum+intervalVolume(ring,stoneRings[i+1],1),0);
const yMin=stoneRings[0][0][1];

/** Volume between bottom of stone and horizontal plane at `draftCm`. */
export function stoneDisplacedByDraft(draftCm){
  if(draftCm<=0) return 0;
  if(draftCm>=stoneHeightCm) return stoneTotalVolumeCm3;
  const cutY=yMin+draftCm;
  let volume=0;
  for(let i=0;i<stoneRings.length-1;i++){
    const a=stoneRings[i],b=stoneRings[i+1];
    const y0=a[0][1],y1=b[0][1];
    if(cutY>=y1){volume+=intervalVolume(a,b,1);continue;}
    if(cutY>y0) volume+=intervalVolume(a,b,(cutY-y0)/(y1-y0));
    break;
  }
  return volume;
}
export function stoneDraftForVolume(volCm3){
  let lo=0,hi=stoneHeightCm;
  const target=Math.max(0,Math.min(stoneTotalVolumeCm3,volCm3));
  for(let i=0;i<45;i++){
    const mid=(lo+hi)/2;
    if(stoneDisplacedByDraft(mid)<target)lo=mid;else hi=mid;
  }
  return (lo+hi)/2;
}
/** Flat-shaded closed triangulated mesh, optionally sliced to submerged draft. */
export function createStoneMeshData(draftCm=stoneHeightCm){
  const draft=Math.max(0.0001,Math.min(stoneHeightCm,draftCm));
  const cutY=yMin+draft;
  const included=[];
  for(let i=0;i<stoneRings.length;i++){
    if(stoneRings[i][0][1]<cutY-1e-8)included.push(stoneRings[i]);
    else if(Math.abs(stoneRings[i][0][1]-cutY)<1e-8){included.push(stoneRings[i]);break;}
    else {
      if(i>0){const a=stoneRings[i-1],b=stoneRings[i];
        included.push(lerpRing(a,b,(cutY-a[0][1])/(b[0][1]-a[0][1])));}
      break;
    }
  }
  if(included.length===1){included.push(lerpRing(stoneRings[0],stoneRings[1],1e-6));}
  const positions=included.flatMap(r=>r.flatMap(v=>v));
  const indices=[];
  for(let i=0;i<included.length-1;i++)for(let j=0;j<SEGMENTS;j++){
    const n=(j+1)%SEGMENTS;
    const a=i*SEGMENTS+j,b=i*SEGMENTS+n,c=(i+1)*SEGMENTS+j,d=(i+1)*SEGMENTS+n;
    indices.push(a,c,b,b,c,d);
  }
  const bottomIdx=positions.length/3;
  positions.push(0,yMin,0);
  const topIdx=positions.length/3;
  positions.push(0,cutY,0);
  for(let j=0;j<SEGMENTS;j++){
    const n=(j+1)%SEGMENTS;
    indices.push(bottomIdx,j,n);
    const base=(included.length-1)*SEGMENTS;
    indices.push(topIdx,base+n,base+j);
  }
  return {positions,indices};
}
/** Cross-sectional polygon at a given height, measured from bottom in cm. */
export function stoneSectionAtDraft(draftCm){
 const d=Math.max(0,Math.min(stoneHeightCm,draftCm));
 const y=yMin+d;
 for(let i=0;i<stoneRings.length-1;i++){
  const a=stoneRings[i],b=stoneRings[i+1];
  if(y<=b[0][1]+1e-9){
    return lerpRing(a,b,Math.max(0,Math.min(1,(y-a[0][1])/(b[0][1]-a[0][1]))));
  }
 }
 return stoneRings.at(-1);
}
