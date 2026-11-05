import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStoneMeshData } from './stone.js';
import { morphMeshData } from './morph.js';
import { BOWL_RADIUS_CM, BOWL_HEIGHT_CM, BOWL_BOTTOM_CM, BOWL_INNER_RADIUS_CM } from './physics.js';

const TANK_X = -1.05;
const CUP_X = 1.72;
const UNIT = 0.1; // world unit per cm
const TANK_HEIGHT = 2.08;
const INITIAL_OBJECT_Y = 2.55;
const SEA_BLUE = '#2198ce';
const waterMatProps = {
  color: '#44badd', transparent: true, opacity: 0.40,
  roughness: 0.11, metalness: 0.05, depthWrite: false, side: THREE.DoubleSide
};

function CameraControls({ dragging }) {
  const { camera, gl, invalidate } = useThree();
  const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl]);
  useEffect(() => {
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI * 0.51;
    controls.minDistance = 5.7;
    controls.maxDistance = 11.5;
    controls.target.set(0.20, 1.13, 0);
    controls.addEventListener('change',invalidate);
    controls.update();
    return () => {controls.removeEventListener('change',invalidate);controls.dispose();};
  }, [controls,invalidate]);
  useEffect(() => { controls.enabled = !dragging; }, [dragging, controls]);
  useFrame(() => controls.update());
  return null;
}

function Edges({ size, position = [0, 0, 0], color = '#9ce7ff', opacity = 0.43 }) {
  const geom = useMemo(() => {
    const box=new THREE.BoxGeometry(...size);
    const edges=new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [size.join(':')]);
  useEffect(()=>()=>geom.dispose(),[geom]);
  return <lineSegments geometry={geom} position={position}>
    <lineBasicMaterial color={color} transparent opacity={opacity}/>
  </lineSegments>;
}

function MuseumStage() {
  return <group>
    <mesh receiveShadow position={[0, -0.075, 0]}>
      <boxGeometry args={[9.3, 0.15, 4.2]}/>
      <meshStandardMaterial color="#102333" roughness={0.35} metalness={0.48}/>
    </mesh>
    <mesh receiveShadow position={[0, -0.16, 0]}>
      <boxGeometry args={[9.5, 0.035, 4.35]}/>
      <meshStandardMaterial color="#b5874a" metalness={0.82} roughness={0.29}/>
    </mesh>
    <mesh receiveShadow position={[0, -0.19, 0]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[200, 200]}/>
      <meshStandardMaterial color="#071421" roughness={0.8}/>
    </mesh>
  </group>;
}

function Tank({ waterLevelCm, showFlow, collectedCm3, reducedMotion }) {
  const {invalidate}=useThree();
  const height = useRef(null);
  const top = useRef(null);
  const animatedLevel = useRef(16);
  useFrame(({clock}, delta) => {
    const next = reducedMotion?waterLevelCm:THREE.MathUtils.damp(animatedLevel.current, waterLevelCm, 5, delta);
    if(Math.abs(next-waterLevelCm)>.0001)invalidate();
    animatedLevel.current = next;
    if (height.current) {
      height.current.scale.y = Math.max(0.005, next * UNIT);
      height.current.position.y = Math.max(0.005, next * UNIT) / 2;
    }
    if (top.current) {
      top.current.position.y = next * UNIT + 0.004;
    }
  });
  const glass = <meshPhysicalMaterial color="#d4f4ff" roughness={0.035} metalness={0.05} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} clearcoat={0.8}/>;
  return <group position={[TANK_X, 0, 0]}>
    <mesh position={[0, -0.015, 0]} receiveShadow>
      <boxGeometry args={[3.14, 0.06, 2.14]}/>
      <meshStandardMaterial color="#c8d9dd" roughness={0.23} metalness={0.78}/>
    </mesh>
    {/* Four separate glass walls; the tank top stays open. */}
    <mesh position={[0, TANK_HEIGHT/2, -1.01]}><boxGeometry args={[3.04, TANK_HEIGHT, 0.035]}/>{glass}</mesh>
    <mesh position={[0, TANK_HEIGHT/2, 1.01]}><boxGeometry args={[3.04, TANK_HEIGHT, 0.035]}/>{glass}</mesh>
    <mesh position={[-1.51, TANK_HEIGHT/2, 0]}><boxGeometry args={[0.035, TANK_HEIGHT, 2.04]}/>{glass}</mesh>
    <mesh position={[1.51, TANK_HEIGHT/2, 0]}><boxGeometry args={[0.035, TANK_HEIGHT, 2.04]}/>{glass}</mesh>
    <Edges size={[3.05, TANK_HEIGHT, 2.05]} position={[0,TANK_HEIGHT/2,0]} opacity={0.70}/>
    <mesh position={[0, 0.005, 0]}>
      <boxGeometry args={[3, 0.03, 2]}/><meshPhysicalMaterial color="#b4def2" transmission={0.45} transparent opacity={0.21}/>
    </mesh>
    <mesh ref={height} position={[0,0.8,0]} renderOrder={1}>
      <boxGeometry args={[3, 1, 2]}/><meshPhysicalMaterial {...waterMatProps}/>
    </mesh>
    <mesh ref={top} rotation={[-Math.PI/2,0,0]} position={[0,1.604,0]} renderOrder={2}>
      <planeGeometry args={[3,2]}/><meshPhysicalMaterial color="#8bdcf1" roughness={0.1} metalness={0.12} transparent opacity={0.35} side={THREE.DoubleSide}/>
    </mesh>
    <OverflowPipe showFlow={showFlow} collectedCm3={collectedCm3}/>
  </group>;
}

function OverflowPipe({ showFlow, collectedCm3 }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.49, 1.6, 0),
    new THREE.Vector3(1.85, 1.6, 0),
    new THREE.Vector3(2.23, 1.57, 0),
    new THREE.Vector3(CUP_X-TANK_X, 1.49, 0),
    new THREE.Vector3(CUP_X-TANK_X, 1.43, 0)
  ]), []);
  const liquidTop=Math.min(1.29,collectedCm3/(Math.PI*36)*UNIT)+.035;
  return <group>
    <mesh>
      <tubeGeometry args={[curve, 42, 0.09, 12, false]}/>
      <meshPhysicalMaterial color="#c6f3ff" transparent opacity={0.40} roughness={0.04} metalness={0.03} side={THREE.DoubleSide}/>
    </mesh>
    {showFlow && <mesh>
      <tubeGeometry args={[curve, 42, 0.052, 10, false]}/>
      <meshPhysicalMaterial color="#29c6f5" transparent opacity={0.79} roughness={0.08}/>
    </mesh>}
    {showFlow&&<mesh position={[CUP_X-TANK_X,(1.43+liquidTop)/2,0]}>
      <cylinderGeometry args={[.027,.04,Math.max(.01,1.43-liquidTop),12]}/>
      <meshPhysicalMaterial color="#65dfff" transparent opacity={.75} roughness={.12}/>
    </mesh>}
  </group>;
}

function Beaker({ collectedCm3, numerical, reducedMotion }) {
  const {invalidate}=useThree();
  const filledHeight = Math.max(0.001, Math.min(1.29, (collectedCm3 / (Math.PI * 6 * 6)) * UNIT));
  const fill = useRef();
  useFrame((_, delta) => {
    if (!fill.current) return;
    const target = filledHeight;
    const newH = reducedMotion?target:THREE.MathUtils.damp(fill.current.scale.y, target, 5, delta);
    if(Math.abs(newH-target)>.00001)invalidate();
    fill.current.scale.y = newH;
    fill.current.position.y = newH/2 + 0.035;
  });
  return <group position={[CUP_X,0,0]}>
    <mesh position={[0,0.67,0]}>
      <cylinderGeometry args={[0.64,0.61,1.34,48,1,true]}/>
      <meshPhysicalMaterial color="#e8fbff" transparent opacity={0.19} roughness={0.045} side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>
    <mesh position={[0,0.025,0]}>
      <cylinderGeometry args={[0.61,0.61,0.05,48]}/>
      <meshPhysicalMaterial color="#d6efff" transparent opacity={0.31}/>
    </mesh>
    <mesh position={[0,1.34,0]} rotation={[-Math.PI/2,0,0]}>
      <torusGeometry args={[0.64,0.025,8,60]}/>
      <meshStandardMaterial color="#caeaff" roughness={0.13} metalness={0.52}/>
    </mesh>
    <mesh ref={fill} position={[0,0.035,0]} scale={[1,0.003,1]}>
      <cylinderGeometry args={[0.60,0.60,1,48]}/>
      <meshPhysicalMaterial color={SEA_BLUE} transparent opacity={0.48} roughness={0.10} depthWrite={false}/>
    </mesh>
    {Array.from({ length: 5 }, (_, i) => <mesh key={i} position={[0.61,0.23+i*0.22,0.015]}>
      <boxGeometry args={[0.007,0.012,0.18]}/><meshBasicMaterial color="#dbf8ff" transparent opacity={0.72}/>
    </mesh>)}
    {numerical&&[250,500,750,1000,1250].map(value=><ScaleLabel key={value} text={String(value)} position={[.13,.035+value/(Math.PI*36)*UNIT,.61]}/>)}
  </group>;
}

function ScaleLabel({text,position}){
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=64;
    const ctx=canvas.getContext('2d');ctx.font='bold 38px sans-serif';ctx.fillStyle='#e3f5ff';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,80,32);
    return new THREE.CanvasTexture(canvas);
  },[text]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <sprite position={position} scale={[.35,.14,1]}><spriteMaterial map={texture} transparent depthTest={false}/></sprite>;
}

function Sample({ object, targetY, started, bottomCm, onManualBottom, onDraggingChange, loadG, rotation, onRotation, reducedMotion }) {
  const {camera,invalidate}=useThree();
  const ref=useRef(null);
  const start=useRef(null);
  const stoneGeom=useMemo(()=>{
    const raw=createStoneMeshData();
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(raw.positions,3));
    g.setIndex(raw.indices);
    g.computeVertexNormals();
    g.scale(UNIT,UNIT,UNIT);
    return g;
  },[]);
  const bowlPoints=useMemo(()=>[
    new THREE.Vector2(0,0),new THREE.Vector2(BOWL_RADIUS_CM*UNIT,0),
    new THREE.Vector2(BOWL_RADIUS_CM*UNIT,BOWL_HEIGHT_CM*UNIT),
    new THREE.Vector2(BOWL_INNER_RADIUS_CM*UNIT,BOWL_HEIGHT_CM*UNIT),
    new THREE.Vector2(BOWL_INNER_RADIUS_CM*UNIT,BOWL_BOTTOM_CM*UNIT),new THREE.Vector2(0,BOWL_BOTTOM_CM*UNIT)
  ],[]);
  useEffect(()=>()=>stoneGeom.dispose(),[stoneGeom]);
  useEffect(()=>()=>onDraggingChange(false),[onDraggingChange]);
  useFrame((_,delta)=>{
    if(!ref.current)return;
    const target=started?targetY:INITIAL_OBJECT_Y;
    ref.current.position.y=reducedMotion?target:THREE.MathUtils.damp(ref.current.position.y,target,4.3,delta);
    if(Math.abs(ref.current.position.y-target)>.0001)invalidate();
  });
  const onDown=e=>{
    if(!started)return;
    e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);
    onDraggingChange(true);
    const normal=camera.getWorldDirection(new THREE.Vector3());
    const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,ref.current.position);
    const hit=e.ray.intersectPlane(plane,new THREE.Vector3());
    if(!hit)return;
    start.current={pointerId:e.pointerId,plane,y:hit.y,x:e.clientX,bottomCm,rotation,rotate:e.shiftKey&&object.kind==='stone'};
  };
  const onMove=e=>{
    if(!start.current||e.pointerId!==start.current.pointerId)return;
    e.stopPropagation();
    if(start.current.rotate){onRotation(start.current.rotation+(e.clientX-start.current.x)*.012);return;}
    const hit=e.ray.intersectPlane(start.current.plane,new THREE.Vector3());
    if(hit)onManualBottom(THREE.MathUtils.clamp(start.current.bottomCm+(hit.y-start.current.y)/UNIT,0,24));
  };
  const onUp=e=>{
    if(!start.current)return;
    e.stopPropagation();
    try{e.target.releasePointerCapture(e.pointerId);}catch{/*already released*/}
    start.current=null;
    onManualBottom(null);
    onDraggingChange(false);
  };
  const cargoSide=Math.cbrt(loadG/7.8)*UNIT;
  return <group ref={ref} name="sample" position={[TANK_X,INITIAL_OBJECT_Y,0]} rotation={[0,rotation,0]}
    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
    {object.kind==='cube' && <>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1,1,1]}/>
        <meshStandardMaterial color={object.id==='wood'?'#df9d4d':'#7c9aa8'} roughness={object.id==='wood'?0.68:0.23} metalness={object.id==='wood'?0.03:0.82}/>
      </mesh>
      <Edges size={[1,1,1]} color={object.id==='wood'?'#f3c88b':'#cce7ee'} opacity={0.64}/>
      {object.id==='wood' && Array.from({length:4},(_,i)=><mesh key={i} position={[-.31+i*.2,0,.506]}>
        <boxGeometry args={[.015,.72,.005]}/><meshBasicMaterial color="#ad733a" transparent opacity={0.31}/>
      </mesh>)}
    </>}
    {object.kind==='stone' && <mesh geometry={stoneGeom} castShadow receiveShadow>
      <meshStandardMaterial color="#a8a39a" roughness={0.93} metalness={0.02} flatShading/>
    </mesh>}
    {object.kind==='bowl' && <>
      <mesh castShadow receiveShadow position={[0,-.4,0]}>
        <latheGeometry args={[bowlPoints,64]}/>
        <meshStandardMaterial color="#bdcad1" metalness={0.82} roughness={0.22} side={THREE.DoubleSide}/>
      </mesh>
      {loadG>0&&<mesh position={[0,-.4+BOWL_BOTTOM_CM*UNIT+cargoSide/2,0]} castShadow>
        <boxGeometry args={[cargoSide,cargoSide,cargoSide]}/><meshStandardMaterial color="#4c606e" roughness={.27} metalness={.8}/>
      </mesh>}
      <mesh position={[0,.39,0]} rotation={[-Math.PI/2,0,0]}>
        <torusGeometry args={[.675,.023,8,64]}/>
        <meshStandardMaterial color="#ecf4f6" metalness={0.86} roughness={0.16}/>
      </mesh>
    </>}
  </group>;
}

function ModelOverlay({object, bottomCm, draftCm, collectedCm3, rotation, reducedMotion}){
  const {invalidate}=useThree();
  const mesh=useRef(null);
  const progress=useRef(0);
  const geom=useMemo(()=>{
    const data=morphMeshData({object,draftCm,progress:0,volumeCm3:collectedCm3});
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(data.positions.length),3));
    g.setIndex(data.indices);
    return g;
  },[object.id,draftCm,collectedCm3]);
  useEffect(()=>()=>geom.dispose(),[geom]);
  useFrame((_,delta)=>{
    if(!mesh.current)return;
    if(progress.current>=1)return;
    // A demand-rendered scene may have idled for minutes. Its first delta must
    // not skip the entire morph on the first frame after pressing the button.
    const step=progress.current===0?Math.min(delta,1/60):delta;
    progress.current=reducedMotion?1:THREE.MathUtils.damp(progress.current,1,1.55,step);
    if(progress.current>0.9995)progress.current=1;
    const p=progress.current;
    const smooth=p*p*(3-2*p);
    const data=morphMeshData({object,draftCm,progress:smooth,volumeCm3:collectedCm3});
    geom.attributes.position.array.set(data.positions);
    geom.attributes.position.needsUpdate=true;
    geom.computeVertexNormals();
    mesh.current.position.set(THREE.MathUtils.lerp(CUP_X,TANK_X,smooth),THREE.MathUtils.lerp(2.05,(bottomCm+draftCm/2)*UNIT,smooth),0);
    mesh.current.rotation.y=rotation*smooth;
    if(progress.current<1)invalidate();
  });
  return <mesh ref={mesh} name="volume-overlay" frustumCulled={false} geometry={geom} position={[CUP_X,2.05,0]} scale={[UNIT,UNIT,UNIT]} renderOrder={10}>
    <meshPhysicalMaterial color="#4bcdf4" transparent opacity={0.32} depthWrite={false} depthTest={false} side={THREE.FrontSide} roughness={0.10} metalness={0.03}/>
  </mesh>;
}

function SceneContents({ object, started, measured, collectedCm3, waterLevelCm, onManualBottom, phase, flowPulse, mode, rotation, onRotation, reducedMotion }) {
  const [dragging,setDragging] = useState(false);
  const [flowing,setFlowing] = useState(false);
  useEffect(() => {
    if (flowPulse <= 0) {setFlowing(false);return;}
    setFlowing(true);
    const t = setTimeout(() => setFlowing(false),1250);
    return () => clearTimeout(t);
  }, [flowPulse]);
  const h = object.heightCm*UNIT;
  const objectY=measured.bottomCm*UNIT+h/2;
  const canOverlay = started && !measured.flooded && Math.abs(collectedCm3-measured.displacedCm3)<0.25 && measured.displacedCm3>0;
  return <>
    <color attach="background" args={['#0a1b2b']}/>
    <fog attach="fog" args={['#0a1b2b',12,23]}/>
    <ambientLight intensity={0.70}/>
    <hemisphereLight args={['#cbf5ff','#253647',2.0]}/>
    <directionalLight position={[-3,8,5]} intensity={2.3} color="#f4d5a0" castShadow shadow-mapSize={[1024,1024]}/>
    <pointLight position={[3,3,0]} color="#70dfff" intensity={23} distance={7}/>
    <pointLight position={[-4,3,-1]} color="#fac47b" intensity={16} distance={8}/>
    <MuseumStage/>
    <Tank waterLevelCm={waterLevelCm} showFlow={flowing&&!reducedMotion} collectedCm3={collectedCm3} reducedMotion={reducedMotion}/>
    <Beaker collectedCm3={collectedCm3} numerical={mode!=='observe'} reducedMotion={reducedMotion}/>
    <Sample key={object.id} object={object} targetY={objectY} started={started} loadG={measured.loadG} bottomCm={measured.bottomCm} rotation={rotation} onRotation={onRotation} onManualBottom={onManualBottom} onDraggingChange={setDragging} reducedMotion={reducedMotion}/>
    {started&&mode==='calc'&&<ForceArrows measured={measured} centerY={objectY}/>}
    {phase===2 && canOverlay && <ModelOverlay key={`${object.id}-${measured.displacedCm3}`} object={object} bottomCm={measured.bottomCm} rotation={rotation} draftCm={measured.draftCm} collectedCm3={collectedCm3} reducedMotion={reducedMotion}/>}
    <CameraControls dragging={dragging}/>
  </>;
}

function ForceArrows({measured,centerY}){
  const forces=[{n:measured.buoyancyN,up:true,color:'#60def1',x:-.78},
    {n:measured.weightN,up:false,color:'#f0c36e',x:.8},
    {n:Math.abs(measured.appliedForceN),up:measured.appliedForceN<0,color:'#e5a3c7',x:1.02},
    {n:measured.bottomReactionN,up:true,color:'#9cdda1',x:-1.0},
    {n:Math.abs(measured.requiredHandForceN),up:measured.requiredHandForceN<0,color:'#e5f2fb',x:1.24}];
  const max=Math.max(...forces.map(f=>f.n),1);
  return <group position={[TANK_X,centerY,.6]} name="force-arrows">{forces.filter(f=>f.n>1e-6).map((f,i)=>{
    const length=.85*f.n/max;
    return <group key={i} position={[f.x,0,0]} rotation={[0,0,f.up?0:Math.PI]}>
      <mesh position={[0,length/2,0]}><cylinderGeometry args={[.015,.015,length,8]}/><meshBasicMaterial color={f.color} depthTest={false}/></mesh>
      <mesh position={[0,length+.035,0]}><coneGeometry args={[.055,.12,12]}/><meshBasicMaterial color={f.color} depthTest={false}/></mesh>
    </group>;
  })}</group>;
}

class SceneBoundary extends React.Component{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<p className="scene-error" role="alert">3D 顯示無法啟動。請啟用瀏覽器硬體加速後重新載入。</p>:this.props.children;}
}

export default function TankScene(props) {
  const [ready,setReady]=useState(false);
  const [reducedMotion,setReducedMotion]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReducedMotion(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  return <SceneBoundary><div className="scene-host" data-scene-ready={ready}>
    <Canvas shadows frameloop="demand" dpr={[1,1.75]} camera={{position:[6.7,3.65,7.7],fov:36,near:0.1,far:80}} gl={{antialias:true,alpha:false}}>
      <SceneContents {...props} reducedMotion={reducedMotion}/>
      <SceneReady onReady={setReady}/>
    </Canvas>
    {!ready&&<div className="scene-loading">正在準備實驗器材…</div>}
  </div></SceneBoundary>;
}

function SceneReady({onReady}){
  const frames=useRef(0),{invalidate}=useThree();
  useFrame(()=>{if(frames.current<3){frames.current++;if(frames.current===3)onReady(true);else invalidate();}});
  return null;
}
