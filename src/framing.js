import {Vector3} from 'three';
export const DEFAULT_VIEW_DIRECTION=[.36,.25,1];
export const INITIAL_SAMPLE_Y=2.55;
function box(points,min,max){for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]])points.push([x,y,z]);}
export function experimentFrame({object,started,bottomCm=0,phase=0,forceActive=false,waterLevelCm=16}){
 const points=[];
 box(points,[-2.64,-.06,-1.08],[.54,2.1,1.08]);
 box(points,[1.05,0,-.67],[2.39,1.4,.67]);
 const h=object.heightCm*.1,center=started?bottomCm*.1+h/2:INITIAL_SAMPLE_Y;
 const radius=object.kind==='bowl'||object.kind==='tilted-bowl'?.86:object.kind==='stone'?.72:.51;
 box(points,[-1.05-radius,center-h/2,-radius],[-1.05+radius,center+h/2,radius]);
 if(phase>=2)box(points,[1.72-radius,2.15-h/2,-radius],[1.72+radius,2.15+h/2,radius]);
 if(forceActive){const y=Math.max(waterLevelCm*.1+.63,bottomCm*.1+h+.5);box(points,[-1.2,y-.3,-.1],[-.9,y+.35,.1]);}
 return {points,margins:{left:18,right:18,top:phase>=2?105:forceActive?58:22,bottom:phase>=2?105:52}};
}
/** Exact perspective corner fit, with space reserved for the overlaid controls.
 * The optical target is shifted so the fit is centered in the usable rectangle.
 */
export function fitFrame({points,width,height,fov=36,direction=DEFAULT_VIEW_DIRECTION,margins={},minDistance=0}){
 const pad={left:18,right:18,top:22,bottom:52,...margins};
 // Very narrow viewports retain a useful scene even when captions wrap.
 pad.top=Math.min(pad.top,height*.28);pad.bottom=Math.min(pad.bottom,height*.29);
 const dir=new Vector3(...direction).normalize(),right=new Vector3(0,1,0).cross(dir).normalize(),up=dir.clone().cross(right).normalize();
 const min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity);
 for(const p of points){const v=new Vector3(...p);min.min(v);max.max(v);}
 const center=min.add(max).multiplyScalar(.5),tanV=Math.tan(fov*Math.PI/360),tanH=tanV*width/height;
 const left=-1+2*pad.left/width,rightLimit=1-2*pad.right/width,top=1-2*pad.top/height,bottom=-1+2*pad.bottom/height;
 let rx=-Infinity,lx=Infinity,ty=-Infinity,by=Infinity,near=1;
 for(const p of points){
   const q=new Vector3(...p).sub(center),x=q.dot(right),y=q.dot(up),z=q.dot(dir);
   rx=Math.max(rx,x+rightLimit*tanH*z);lx=Math.min(lx,x+left*tanH*z);
   ty=Math.max(ty,y+top*tanV*z);by=Math.min(by,y+bottom*tanV*z);near=Math.max(near,z+.2);
 }
 const distance=Math.max(Math.max(near,(rx-lx)/((rightLimit-left)*tanH),(ty-by)/((top-bottom)*tanV))*1.02,minDistance);
 const offsetX=(rx-rightLimit*tanH*distance+lx-left*tanH*distance)/2;
 const offsetY=(ty-top*tanV*distance+by-bottom*tanV*distance)/2;
 const target=center.clone().addScaledVector(right,offsetX).addScaledVector(up,offsetY),position=target.clone().addScaledVector(dir,distance);
 return {target:target.toArray(),position:position.toArray(),distance,margins:pad};
}
