import test from 'node:test';
import assert from 'node:assert/strict';
import {LatheGeometry,Vector2} from 'three';
import {BOWL_RADIUS_CM,BOWL_HEIGHT_CM,BOWL_CAPACITY_CM3,bowlOuterRadiusAt,bowlOuterVolumeAt,bowlCavityVolumeAt,bowlProfile,bowlWaterCapacity,bowlWaterHeight,bowlWaterBelow,bowlCargoBottomCm,bowlInnerRadiusAt,bowlCargoVolume} from '../src/bowl.js';
const near=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

test('the bowl has a rounded bottom and a calibrated 100 cm³ steel shell',()=>{
 near(bowlOuterRadiusAt(0),0);near(bowlOuterRadiusAt(BOWL_HEIGHT_CM),BOWL_RADIUS_CM);
 assert.ok(bowlOuterRadiusAt(1)>0&&bowlOuterRadiusAt(1)<BOWL_RADIUS_CM);
 near(bowlOuterVolumeAt(BOWL_HEIGHT_CM),BOWL_CAPACITY_CM3);
 near(bowlOuterVolumeAt(BOWL_HEIGHT_CM)-bowlCavityVolumeAt(BOWL_HEIGHT_CM),100);
 // Independently integrate the squared radii instead of reusing the volume formula.
 let integral=0;const dy=BOWL_HEIGHT_CM/20000;
 for(let i=0;i<20000;i++)integral+=Math.PI*bowlOuterRadiusAt((i+.5)*dy)**2*dy;
 near(integral,BOWL_CAPACITY_CM3,.00001);
});

test('the actual rendered curved shell encloses approximately its calibrated steel volume',()=>{
 const geometry=new LatheGeometry(bowlProfile().map(([r,y])=>new Vector2(r,y)),128);
 const p=geometry.attributes.position.array,id=geometry.index.array;let six=0;
 for(let i=0;i<id.length;i+=3){
   const a=id[i]*3,b=id[i+1]*3,c=id[i+2]*3;
   six+=p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])+p[a+1]*(p[b+2]*p[c]-p[b]*p[c+2])+p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]);
 }
 near(Math.abs(six)/6,100,.1);geometry.dispose();
});

test('cargo sits inside the curved bowl and water level inverts its available cavity volume',()=>{
 for(const load of [0,250,700,1000]){
   const side=Math.cbrt(bowlCargoVolume(load));
   assert.ok(bowlInnerRadiusAt(bowlCargoBottomCm(load))+1e-7>=side/Math.sqrt(2));
   for(const fraction of [.01,.2,.6,1]){
     const volume=bowlWaterCapacity(load)*fraction;
     near(bowlWaterBelow(bowlWaterHeight(volume,load),load),volume);
   }
 }
});
