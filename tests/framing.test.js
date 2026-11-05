import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {OBJECTS} from '../src/physics.js';
import {experimentFrame,fitFrame} from '../src/framing.js';

for(const [width,height] of [[672,367],[846,666],[523,450],[378,350],[308,350]])test(`apparatus fits the usable scene at ${width} x ${height}`,()=>{
 for(const object of Object.values(OBJECTS))for(const state of [{started:false},{started:true,bottomCm:0},{started:true,bottomCm:24,forceActive:true},{started:true,bottomCm:0,phase:2}]){
   const frame=experimentFrame({object,...state}),fit=fitFrame({...frame,width,height});
   const camera=new PerspectiveCamera(36,width/height,.1,80);camera.position.fromArray(fit.position);camera.lookAt(...fit.target);camera.updateMatrixWorld();
   const screen=frame.points.map(p=>{const q=new Vector3(...p).project(camera);return {x:(q.x+1)*width/2,y:(1-q.y)*height/2};});
   const minX=Math.min(...screen.map(p=>p.x)),maxX=Math.max(...screen.map(p=>p.x)),minY=Math.min(...screen.map(p=>p.y)),maxY=Math.max(...screen.map(p=>p.y));
   assert.ok(minX>=fit.margins.left-.01&&maxX<=width-fit.margins.right+.01);
   assert.ok(minY>=fit.margins.top-.01&&maxY<=height-fit.margins.bottom+.01);
   assert.ok(Math.max((maxX-minX)/(width-fit.margins.left-fit.margins.right),(maxY-minY)/(height-fit.margins.top-fit.margins.bottom))>.9,'the fit should make use of the available frame');
 }
});
