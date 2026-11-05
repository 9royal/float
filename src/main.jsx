import React, { useReducer, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import TankScene from './Scene.jsx';
import { OBJECTS } from './physics.js';
import { createExperiment, experimentReducer } from './experiment.js';
import './style.css';
import roMark from '../ro-mark-white.svg?raw';

const roSignature = roMark.replace('<svg ', '<svg role="img" aria-label="Ro" ');

const fmt = (x, places=1) => new Intl.NumberFormat('zh-TW',{maximumFractionDigits:places,minimumFractionDigits:places}).format(x);

function App(){
  const [experiment, dispatch] = useReducer(experimentReducer, undefined, createExperiment);
  const {objectId,density,externalForce,loadG,started,manualBottomCm,collectedCm3,phase,animationReady,flowPulse,rotation,measured,water} = experiment;
  const [mode, setMode] = useState('observe');
  const helpRef = useRef(null);
  const object = OBJECTS[objectId];
  const displacement = started ? measured.displacedCm3 : 0;
  const compareValid = !measured.flooded&&displacement>0&&Math.abs(collectedCm3-displacement)<0.25;
  const modelBusy = phase>=2&&!animationReady;
  const nextLabel = !started ? '放入水中' : phase===0 ? '觀察收集量杯' : phase===1&&compareValid ? '變形' : phase===2 ? (modelBusy?'變形中…':'疊合') : phase===3&&modelBusy ? '疊合中…' : '返回實驗操作';
  const isNumerical = mode !== 'observe';
  const isFormula = mode === 'calc';
  const onSceneKeyDown = e => {
    if(!started)return;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();
      dispatch({type:'hold',bottomCm:measured.bottomCm+(e.key==='ArrowDown'?-0.5:0.5)});
    }else if(e.key==='Escape')dispatch({type:'hold',bottomCm:null});
    else if(e.key.toLowerCase()==='r'&&objectId==='stone')dispatch({type:'rotate',value:rotation+Math.PI/12});
  };

  return <div className="app">
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">≋</div>
        <div><div className="brand-zh">浮力實驗室</div><div className="brand-en">Buoyancy Lab</div></div>
      </div>
      <div className="subtitle">排水體積 · 浮力 · 阿基米德原理</div>
      <nav className="mode-switch" aria-label="資訊顯示模式">
        {[['observe','觀察'],['numbers','數值'],['calc','計算']].map(([id,label])=><button key={id} type="button" aria-pressed={mode===id} className={mode===id?'active':''} onClick={()=>setMode(id)}>{label}</button>)}
      </nav>
      <button type="button" className="help" onClick={()=>helpRef.current.showModal()} aria-label="操作說明">?</button>
    </header>
    <main className="workspace">
      <aside className="settings panel">
        <section>
          <h2><span>◈</span> 選擇物體</h2>
          <div className="object-grid">
            {Object.values(OBJECTS).map(item=><button key={item.id} className={`object-choice ${objectId===item.id?'selected':''}`} onClick={()=>dispatch({type:'object',id:item.id})} aria-pressed={objectId===item.id}>
              <span className={item.kind==='bowl'?'bowl-icon':item.kind==='stone'?'stone-icon':`cube-icon ${item.id}`} aria-hidden="true"/><span>{item.label}</span>
            </button>)}
          </div>
          {objectId==='bowl' && <p className="hint">中空鐵碗與鋼製砝碼；進水採靜態簡化模型。</p>}
        </section>
        <section className="control-section">
          <h2><span>◉</span> 液體密度</h2>
          <input type="range" min="1" max="1.2" step="0.01" value={density} aria-label="液體密度" onChange={e=>dispatch({type:'density',value:e.target.value})} />
          <div className="range-label"><span>清水</span><span>濃鹽水</span></div>
          {isNumerical && <div className="control-number">{fmt(density,2)} g/cm³</div>}
        </section>
        <section className="control-section">
          <h2><span>⇅</span> 外力（向下為正）</h2>
          <input type="range" min={-object.maxForce} max={object.maxForce} step={object.id==='wood'?'0.1':'0.2'} value={externalForce} aria-label="向上或向下的外力" onChange={e=>dispatch({type:'force',value:e.target.value})} onDoubleClick={()=>dispatch({type:'force',value:0})}/>
          <div className="range-label"><span>向上拉</span><span>無外力</span><span>向下壓</span></div>
          {isNumerical && <div className="control-number">{fmt(externalForce,1)} N</div>}
          {objectId==='wood'&&<p className="hint">拖曳木塊或用方向鍵定位，按「放開木塊」才釋放。施力標記留在水面外，不佔排水體積；調整外力滑桿也會釋放定位。</p>}
          {objectId==='wood'&&<button type="button" className="release" disabled={manualBottomCm===null} onClick={()=>dispatch({type:'hold',bottomCm:null})}>放開木塊</button>}
          {manualBottomCm!==null&&<p className="hint hold-hint">{objectId==='wood'?'木塊已定位，約束力維持目前位置。':'正在手動控制浸水深度，放開後恢復平衡。'}</p>}
        </section>
        {objectId==='bowl' && <section className="control-section">
          <h2><span>⚖</span> 鐵碗載重</h2>
          <input type="range" min="0" max="1000" step="25" value={loadG} aria-label="鐵碗額外載重" onChange={e=>dispatch({type:'load',value:e.target.value})}/>
          <div className="range-label"><span>空碗</span><span>增加砝碼</span></div>
          {isNumerical && <div className="control-number">{fmt(loadG,0)} g</div>}
          {started&&measured.flooded && <p className="hint warning">鐵碗已進水；減輕載重不會自動恢復空碗。重設實驗可排水再試。</p>}
        </section>}
        <section className="reset-section">
          <button type="button" className="reset" onClick={()=>dispatch({type:'reset'})}>↺ 重設實驗</button>
        </section>
      </aside>

      <section className="center" aria-label="3D 浮力實驗展示">
        <div className="stage" role="group" aria-label="互動水缸，方向鍵升降物體，R 轉動石頭" tabIndex={0} onKeyDown={onSceneKeyDown}
          onKeyUp={e=>{if(objectId!=='wood'&&(e.key==='ArrowUp'||e.key==='ArrowDown'))dispatch({type:'hold',bottomCm:null});}}
          onBlur={()=>{if(objectId!=='wood'&&manualBottomCm!==null)dispatch({type:'hold',bottomCm:null});}}>
          <TankScene object={object} started={started} density={density} measured={measured}
            collectedCm3={collectedCm3} waterLevelCm={water.levelCm} manualBottomCm={manualBottomCm}
            onManualBottom={bottomCm=>dispatch({type:'hold',bottomCm})} rotation={rotation} onRotation={value=>dispatch({type:'rotate',value})} phase={phase}
            onModelReady={value=>dispatch({type:'animation-complete',phase:value})} flowPulse={flowPulse} mode={mode}/>
          <div className="glass-note">拖曳空白處旋轉 · 滾輪縮放 · 拖曳物體升降</div>
          <div className="stage-corner" role="status">{started?(objectId==='wood'&&manualBottomCm!==null?'定位保持':measured.state):'準備實驗'}</div>
          {phase>=2&&compareValid&&<div className="model-note">{phase===2?'變形：水模型停在量杯上方，完成後按「疊合」。':'疊合：水模型對準物體的水下部分。'} 演示保留原收集紀錄。</div>}
        </div>
        <div className="timeline panel">
          <div className="steps" aria-label="實驗步驟">
            {['1 放入物體','2 觀察量杯','3 變形','4 疊合'].map((name,i)=><span className={(started && phase===i)?'current':''} aria-current={started&&phase===i?'step':undefined} key={i}>{name}</span>)}
          </div>
          <button type="button" className="primary" disabled={modelBusy} onClick={()=>dispatch({type:'advance'})}>{nextLabel} <span aria-hidden="true">›</span></button>
        </div>
      </section>

      <aside className="results">
        <section className="panel feature-panel">
          <h2>排出的液體 · 等體積重組</h2>
          <div className="feature-sequence" aria-label="同一份排出液體的轉換步驟">
            <span>量杯收集</span><span className="art-arrow">›</span><span>變形成水下外型</span><span className="art-arrow">›</span><span>移動並疊合</span>
          </div>
          <div className="feature-text">
            {!started ? '把物體放入水中，再觀察實際收集的液體。' :
              phase===0 ? '觀察水從溢流口流進量杯。' :
              measured.flooded ? '鐵碗已進水，水可進入碗內；不適用未進水時的外形疊合。' :
              !compareValid ? '已收集的液體量與當下浸入體積不同，不能直接疊合；請重設後比較。' :
              phase===1 ? '按「變形」，將量杯液體抽出，形成物體水下部分的外型，並標示體積。' :
              phase===2 ? '水模型先在量杯上方完成變形，體積保持不變；按「疊合」才會移向物體。' :
              '水模型移到物體水下部分疊合，對照相同形狀與體積。返回操作後，量杯恢復液體顯示。'}
          </div>
        </section>
        {isNumerical ? <section className="panel results-panel">
          <h2>實驗結果</h2>
          <dl>
            <div><dt>液體密度</dt><dd>{fmt(density,2)} g/cm³</dd></div>
            <div><dt>當下排水體積</dt><dd data-testid="displacement">{started?`${fmt(displacement)} cm³`:'—'}</dd></div>
            <div><dt>量杯累積溢出量</dt><dd data-testid="collected">{started?`${fmt(collectedCm3)} mL`:'—'}</dd></div>
            <div><dt>浮力</dt><dd data-testid="buoyancy">{started?`${fmt(measured.buoyancyN,2)} N`:'—'}</dd></div>
            <div><dt>物體重力</dt><dd>{fmt(measured.weightN,2)} N</dd></div>
            <div><dt>液面高度</dt><dd data-testid="water-level">{started?`${fmt(water.levelCm,2)} cm`:'—'}</dd></div>
            <div><dt>浸入深度比例</dt><dd>{started?`${fmt(measured.immersionRatio*100)}%`:'—'}</dd></div>
            {objectId==='bowl' && <div><dt>鐵碗載重</dt><dd>{fmt(loadG,0)} g</dd></div>}
            {isFormula&&started&&<>
              <div><dt>外力（向下為正）</dt><dd>{fmt(externalForce,2)} N</dd></div>
              <div><dt>缸底支持力</dt><dd data-testid="support">{fmt(measured.bottomReactionN,2)} N</dd></div>
              {manualBottomCm!==null&&<div><dt>定位約束力（向下為正）</dt><dd data-testid="hand-force">{fmt(measured.requiredHandForceN,2)} N</dd></div>}
            </>}
          </dl>
        </section> : null}
        {isFormula && <section className="panel formula-panel">
          <h2>阿基米德原理</h2>
          <div className="equation">F<sub>B</sub> = ρ<sub>液</sub> g V<sub>浸</sub></div>
          <p>浮力等於物體排開液體的重量。</p>
          <p>漂浮平衡且沒有其他接觸力時：浮力 = 重力 + 向下外力 − 向上外力。</p>
          <p>物體沉底時，還必須計入缸底的支持力。</p>
          <div className="force-legend"><span className="force-buoyancy">↑ 浮力</span><span className="force-weight">↓ 重力</span><span className="force-external">↕ 外力</span><span className="force-support">↑ 支持力</span>{manualBottomCm!==null&&<span>↕ 定位約束力</span>}</div>
          {started&&<p className="substitution">浮力 = {fmt(density,2)} × 1,000 × 9.8 × ({fmt(displacement,2)} × 10⁻⁶) = {fmt(measured.buoyancyN,2)} N</p>}
          <p className="formula-note">運算採 g = 9.8 m/s²；液體密度以 g/cm³ 表示。</p>
        </section>}
        {!isNumerical && <section className="panel observation-panel"><h2>觀察任務</h2>
          {objectId==='wood' && <><p>木塊為什麼只浸入一部分？</p><p>向下壓再放開，觀察量杯與液面。</p></>}
          {objectId==='iron' && <><p>鐵塊完全浸沒後，向上拉但仍留在水中，水量有什麼變化？</p></>}
          {objectId==='stone' && <><p>石頭形狀不規則，排出液體如何反映它的體積？</p></>}
          {objectId==='bowl' && <><p>鐵做的碗為什麼可以浮？逐步加重，什麼時候會進水？</p></>}
        </section>}
      </aside>
    </main>
    <footer className="footer"><span>Buoyancy Lab v0.4 · 靜力平衡實驗</span><span className="footer-signature"><span>阿基米德原理 · 體積守恆</span><span className="ro-signature" dangerouslySetInnerHTML={{__html:roSignature}}/></span></footer>
    <dialog ref={helpRef} id="explain" className="explain" aria-labelledby="help-title">
      <h2 id="help-title">操作說明</h2>
      <p>先選擇物體，再點選「放入水中」。拖曳木塊可定位在指定深度，鬆開滑鼠或手指後仍會保持；按「放開木塊」或 Escape 才回到自由平衡。水面外的標記代表理想化施力，不是浸入水中的物體。其他物體拖曳後放開即恢復平衡。</p>
      <p>左側密度滑桿會以新的液體重新開始已開啟的實驗，並補滿水缸。外力滑桿向右代表向下壓，向左代表向上拉。</p>
      <p>觸控可直接拖曳物體。鍵盤使用者可聚焦水缸，以方向鍵升降；木塊維持定位，其他物體放開按鍵後恢復平衡。石頭可按 R 或按住 Shift 拖曳，繞鉛直軸旋轉。調整外力滑桿會釋放定位，雙擊可歸零。</p>
      <p>依序「觀察收集量杯」→「變形」→「疊合」。變形先把量杯液體抽出作等體積模型，完成後停在量杯上方並標示體積；再次操作才移向物體的水下部分。演示期間量杯的液體隱藏，收集紀錄不變；返回操作後恢復顯示。</p>
      <p>量杯顯示累積收集量，不會因物體上浮而倒流；若累積收集量與當下浸入體積不同，系統不會錯誤地把兩者當成同一個模型疊合。石頭以橫截面積分計算體積；鐵碗進水是教學簡化模型。</p>
      <p>進水後，鐵碗以可與水交換的鋼殼及鋼製砝碼計算排水量，必須重設才恢復空碗。場景的移動是平衡位置過渡，並未計算真實加速度、水阻或進水速率。</p>
      <p><a href="https://openstax.org/books/university-physics-volume-1/pages/14-4-archimedes-principle-and-buoyancy" target="_blank" rel="noreferrer">物理依據：OpenStax 阿基米德原理</a></p>
      <form method="dialog"><button type="submit" className="primary">返回實驗</button></form>
    </dialog>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
