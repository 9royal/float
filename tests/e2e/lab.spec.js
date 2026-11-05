import {test,expect} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {mkdir} from 'node:fs/promises';
import {BOWL_CAPACITY_CM3,bowlWaterCapacity} from '../../src/bowl.js';
import {OBJECTS} from '../../src/physics.js';

async function slider(page,name,value){
  const input=page.getByRole('slider',{name,exact:true});
  const min=Number(await input.getAttribute('min')),max=Number(await input.getAttribute('max')),step=Number(await input.getAttribute('data-step')||await input.getAttribute('step'));
  const fromEnd=Math.abs(max-value)<Math.abs(value-min);
  await input.press(fromEnd?'End':'Home');
  for(let i=0;i<Math.round(Math.abs(value-(fromEnd?max:min))/step);i++)await input.press(fromEnd?'ArrowLeft':'ArrowRight');
}
const number=async(page,id)=>Number((await page.getByTestId(id).innerText()).replace(/[^\d.\-]/g,''));
async function image(page,name){await mkdir('qa',{recursive:true});await page.screenshot({path:`qa/${name}.png`,fullPage:true});}
async function samplePoint(page,y){
  const box=await page.locator('canvas').boundingBox();
  const info=JSON.parse(await page.locator('canvas').getAttribute('data-camera'));
  const camera=new PerspectiveCamera(info.fov,box.width/box.height,.1,80);
  camera.position.fromArray(info.position);camera.lookAt(...info.target);camera.updateMatrixWorld();
  const point=new Vector3(-1.05,y,0).project(camera);
  return {x:box.x+(point.x+1)*box.width/2,y:box.y+(1-point.y)*box.height/2};
}

test.beforeEach(async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.getByRole('button',{name:'放入水中',exact:true})).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible();
});

test('observation starts without answers and has one selector and action per function',async({page})=>{
  await expect(page.locator('.results-panel,.equation,.control-number')).toHaveCount(0);
  for(const name of ['木塊','鐵塊','石頭','鐵碗','立鐵碗'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(1);
  await expect(page.getByRole('button',{name:'↺ 重設實驗',exact:true})).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('準備實驗');
  await image(page,'01-observation');
});

test('wood density and applied force show the four agreed numerical cases',async({page})=>{
  await page.getByRole('button',{name:'數值',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  expect(await number(page,'displacement')).toBeCloseTo(600,1);expect(await number(page,'buoyancy')).toBeCloseTo(5.88,2);
  await slider(page,'液體密度',1.2);expect(await number(page,'displacement')).toBeCloseTo(500,1);
  await slider(page,'向上或向下的外力',2);expect(await number(page,'displacement')).toBeCloseTo(670.1,1);expect(await number(page,'buoyancy')).toBeCloseTo(7.88,2);
  await slider(page,'液體密度',1);expect(await number(page,'displacement')).toBeCloseTo(804.1,1);
  await image(page,'02-wood-force');
});

test('the object choices sit between the brand and mode switch and observation asks before revealing equality',async({page})=>{
  await expect(page.locator('.subtitle')).toHaveCount(0);
  const brand=await page.locator('.brand').boundingBox(),choices=await page.getByRole('navigation',{name:'選擇物體'}).boundingBox(),modes=await page.getByRole('navigation',{name:'資訊顯示模式'}).boundingBox();
  expect(choices.x).toBeGreaterThan(brand.x+brand.width);expect(choices.x+choices.width).toBeLessThanOrEqual(modes.x);
  const objectButtons=await page.locator('.object-picker button').all();const boxes=await Promise.all(objectButtons.map(b=>b.boundingBox()));
  expect(Math.max(...boxes.map(b=>b.y))-Math.min(...boxes.map(b=>b.y))).toBeLessThan(2);
  await expect(page.getByTestId('volume-relation')).toContainText('有什麼關係？');await expect(page.getByTestId('volume-relation')).not.toContainText('=');
  for(const mode of ['數值','計算']){await page.getByRole('button',{name:mode,exact:true}).click();await expect(page.getByTestId('volume-relation')).toHaveText(/量杯收集的水\s*=\s*浸入部分體積/);}
  await page.getByRole('button',{name:'觀察',exact:true}).click();await expect(page.getByTestId('volume-relation')).not.toContainText('=');await image(page,'12-top-object-picker');
});

test('the enlarged default view fits every object and reset sits immediately before observation',async({page})=>{
  await expect(page.locator('.settings .reset')).toHaveCount(0);
  for(const size of [{width:1280,height:606},{width:390,height:844}]){
    await page.setViewportSize(size);
    const reset=await page.getByRole('button',{name:'↺ 重設實驗',exact:true}).boundingBox(),observe=await page.getByRole('button',{name:'觀察',exact:true}).boundingBox();
    expect(reset.x+reset.width).toBeLessThanOrEqual(observe.x);expect(Math.abs(reset.y+reset.height/2-observe.y-observe.height/2)).toBeLessThan(2);
    for(const object of Object.values(OBJECTS)){
      await page.getByRole('button',{name:object.label,exact:true}).click();
      await expect.poll(async()=>{
        const box=await page.locator('canvas').boundingBox(),info=JSON.parse(await page.locator('canvas').getAttribute('data-camera'));
        const camera=new PerspectiveCamera(info.fov,box.width/box.height,.1,80);camera.position.fromArray(info.position);camera.lookAt(...info.target);camera.updateMatrixWorld();
        const points=[],add=(min,max)=>{for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]])points.push(new Vector3(x,y,z).project(camera));};
        add([-2.64,-.06,-1.08],[.54,2.1,1.08]);add([1.05,0,-.67],[2.39,1.4,.67]);
        const r=object.kind==='bowl'||object.kind==='tilted-bowl'?.86:object.kind==='stone'?.72:.51,h=object.heightCm*.1;
        add([-1.05-r,2.55-h/2,-r],[-1.05+r,2.55+h/2,r]);
        const x=points.map(p=>(p.x+1)*box.width/2),y=points.map(p=>(1-p.y)*box.height/2);
        return Math.min(...x)>=16&&Math.max(...x)<=box.width-16&&Math.min(...y)>=20&&Math.max(...y)<=box.height-50&&Math.max((Math.max(...x)-Math.min(...x))/(box.width-36),(Math.max(...y)-Math.min(...y))/(box.height-74))>.9;
      }).toBe(true);
    }
  }
  await page.setViewportSize({width:1280,height:606});await page.getByRole('button',{name:'鐵碗',exact:true}).click();await page.waitForTimeout(400);await image(page,'15-large-default');
  const initial=JSON.parse(await page.locator('canvas').getAttribute('data-camera'));
  const distance=q=>new Vector3(...q.position).distanceTo(new Vector3(...q.target));
  await page.locator('canvas').hover();await page.mouse.wheel(0,-450);await page.waitForTimeout(700);
  expect(distance(JSON.parse(await page.locator('canvas').getAttribute('data-camera')))).toBeLessThan(distance(initial)-.2);
  await page.getByRole('button',{name:'↺ 重設實驗',exact:true}).click();
  await expect.poll(async()=>distance(JSON.parse(await page.locator('canvas').getAttribute('data-camera')))).toBeCloseTo(distance(initial),2);
});

test('the side-tilted bowl measures only its 100 cm³ steel shell and overlays the same hollow shape',async({page})=>{
  await page.getByRole('button',{name:'立鐵碗',exact:true}).click();await page.getByRole('button',{name:'計算',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  expect(await number(page,'displacement')).toBeCloseTo(100,1);expect(await number(page,'collected')).toBeCloseTo(100,1);
  expect(await number(page,'buoyancy')).toBeCloseTo(.98,2);expect(await number(page,'support')).toBeCloseTo(6.66,2);expect(await number(page,'retained-water')).toBe(0);
  await page.getByRole('button',{name:'觀察收集量杯',exact:true}).click();await page.getByRole('button',{name:'變形',exact:true}).click();
  await expect(page.getByRole('button',{name:'疊合',exact:true})).toBeEnabled({timeout:15000});await expect(page.getByTestId('model-volume')).toContainText('100 cm³');
  await page.getByRole('button',{name:'疊合',exact:true}).click();await expect(page.getByRole('button',{name:'返回實驗操作',exact:true})).toBeEnabled({timeout:15000});await image(page,'14-standing-steel-overlay');
  await page.getByRole('button',{name:'返回實驗操作',exact:true}).click();for(let i=0;i<12;i++)await page.locator('.stage').press('ArrowUp');
  expect(await number(page,'displacement')).toBeLessThan(100);await page.getByRole('button',{name:'觀察收集量杯',exact:true}).click();
  await expect(page.getByRole('button',{name:'返回實驗操作',exact:true})).toBeVisible();await expect(page.getByTestId('model-volume')).toHaveCount(0);
});

test('pointer dragging fixes wood until explicit release and preserves the collected water',async({page})=>{
  await page.getByRole('button',{name:'數值',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  // Wait for the illustrative transition to settle before hit testing the mesh.
  await page.waitForTimeout(1800);
  const p=await samplePoint(page,1.5);
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x,p.y+150,{steps:12});
  await expect(page.getByRole('status')).toHaveText('定位保持');expect(await number(page,'displacement')).toBeCloseTo(1000,1);
  expect(await number(page,'external-force-control')).toBeCloseTo(3.92,2);
  await page.mouse.up();await expect(page.getByRole('status')).toHaveText('定位保持');
  await expect(page.getByTestId('force-marker')).toContainText('水面外的施力示意');
  await page.waitForTimeout(600);expect(await number(page,'displacement')).toBeCloseTo(1000,1);await image(page,'03a-wood-held');
  await page.getByRole('button',{name:'放開木塊',exact:true}).click();await expect(page.getByRole('status')).toHaveText('漂浮平衡');
  expect(await number(page,'collected')).toBeCloseTo(1000,1);expect(await number(page,'displacement')).toBeCloseTo(600,1);expect(await number(page,'water-level')).toBeCloseTo(15.33,2);
  await page.getByRole('button',{name:'觀察收集量杯',exact:true}).click();await expect(page.getByRole('button',{name:'返回實驗操作',exact:true})).toBeVisible();
  await expect(page.locator('.model-note')).toHaveCount(0);await image(page,'03-release-no-return');
});

test('keyboard depth control holds wood after keyup and Escape releases it',async({page})=>{
  await page.getByRole('button',{name:'計算',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  await page.locator('.stage').focus();for(let i=0;i<24;i++)await page.keyboard.down('ArrowDown');
  expect(await number(page,'displacement')).toBeCloseTo(1000,1);expect(await number(page,'external-force')).toBeCloseTo(3.92,2);await page.keyboard.up('ArrowDown');
  expect(Number(await page.getByRole('slider',{name:'向上或向下的外力',exact:true}).inputValue())).toBeCloseTo(3.92,2);
  await expect(page.getByRole('status')).toHaveText('定位保持');expect(await number(page,'displacement')).toBeCloseTo(1000,1);
  await page.keyboard.press('Escape');
  expect(await number(page,'displacement')).toBeCloseTo(600,1);expect(await number(page,'collected')).toBeCloseTo(1000,1);
});

test('iron shows bottom support, sufficient lifting force, and a fresh liquid experiment',async({page})=>{
  await page.getByRole('button',{name:'鐵塊',exact:true}).click();await page.getByRole('button',{name:'計算',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  expect(await number(page,'support')).toBeCloseTo(66.64,2);expect(await number(page,'buoyancy')).toBeCloseTo(9.8,2);
  await page.waitForTimeout(1200);await image(page,'04-iron-support');
  await slider(page,'向上或向下的外力',-70);expect(await number(page,'support')).toBe(0);expect(await number(page,'displacement')).toBeLessThan(1000);
  await slider(page,'液體密度',1.2);expect(await number(page,'collected')).toBeCloseTo(await number(page,'displacement'),1);
});

test('transformation stays above the cup with a volume label until a separate overlay action',async({page})=>{
  await page.getByRole('button',{name:'石頭',exact:true}).click();await page.getByRole('button',{name:'數值',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  expect(await number(page,'displacement')).toBeCloseTo(1000,1);
  await page.locator('.stage').press('r');await page.getByRole('button',{name:'觀察收集量杯',exact:true}).click();await page.getByRole('button',{name:'變形',exact:true}).click();
  await expect(page.getByRole('button',{name:'變形中…',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'疊合',exact:true})).toBeEnabled({timeout:15000});
  await expect(page.getByTestId('model-volume')).toContainText('1,000 cm³');
  const atCup=await page.getByTestId('model-volume').boundingBox();await image(page,'05a-stone-transform');
  await page.waitForTimeout(500);const stillAtCup=await page.getByTestId('model-volume').boundingBox();expect(stillAtCup.x).toBeCloseTo(atCup.x,0);
  await page.getByRole('button',{name:'疊合',exact:true}).click();await expect(page.getByRole('button',{name:'返回實驗操作',exact:true})).toBeEnabled({timeout:15000});
  const atObject=await page.getByTestId('model-volume').boundingBox();expect(atObject.x).toBeLessThan(atCup.x-40);
  expect(await number(page,'collected')).toBeCloseTo(1000,1);await image(page,'05-stone-overlay');
});

test('iron overlays its underwater part without changing the collection record',async({page})=>{
  await page.getByRole('button',{name:'數值',exact:true}).click();
  await page.getByRole('button',{name:'鐵塊',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();await page.getByRole('button',{name:'觀察收集量杯',exact:true}).click();await page.getByRole('button',{name:'變形',exact:true}).click();
  await expect(page.getByRole('button',{name:'疊合',exact:true})).toBeEnabled({timeout:15000});await page.getByRole('button',{name:'疊合',exact:true}).click();
  await expect(page.getByRole('button',{name:'返回實驗操作',exact:true})).toBeEnabled({timeout:15000});
  expect(await number(page,'collected')).toBeCloseTo(1000,1);await image(page,'06-iron-overlay');
});

test('observation mode reveals the model volume only during transformation and force changes release a hold',async({page})=>{
  await page.getByRole('button',{name:'放入水中',exact:true}).click();
  await expect(page.getByTestId('model-volume')).toHaveCount(0);
  await page.getByRole('button',{name:'觀察收集量杯',exact:true}).click();await page.getByRole('button',{name:'變形',exact:true}).click();
  await expect(page.getByTestId('model-volume')).toContainText('600 cm³');
  await expect(page.getByRole('button',{name:'疊合',exact:true})).toBeEnabled({timeout:15000});
  await page.setViewportSize({width:390,height:844});await page.locator('canvas').scrollIntoViewIfNeeded();
  const canvasBox=await page.locator('canvas').boundingBox(),labelBox=await page.getByTestId('model-volume').boundingBox();
  expect(labelBox.x).toBeGreaterThanOrEqual(canvasBox.x);expect(labelBox.x+labelBox.width).toBeLessThanOrEqual(canvasBox.x+canvasBox.width);
  expect(labelBox.y).toBeGreaterThanOrEqual(canvasBox.y);await image(page,'11-mobile-transform');
  await page.locator('.stage').press('ArrowDown');await expect(page.getByRole('status')).toHaveText('定位保持');
  await expect(page.getByTestId('model-volume')).toHaveCount(0);
  await slider(page,'向上或向下的外力',2);await expect(page.getByRole('status')).toHaveText('受力平衡');
  await expect(page.getByRole('button',{name:'放開木塊',exact:true})).toBeDisabled();
  await expect(page.getByTestId('force-marker')).toContainText('向下施力');
});

test('bowl is hollow, carries cargo, floods and requires reset to become dry again',async({page})=>{
  await page.getByRole('button',{name:'鐵碗',exact:true}).click();await page.getByRole('button',{name:'數值',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  expect(await number(page,'displacement')).toBeCloseTo(780,1);await page.waitForTimeout(1200);await image(page,'07-bowl-floating');
  await slider(page,'鐵碗額外載重',700);await expect(page.getByRole('status')).toHaveText('進水沉底');expect(await number(page,'collected')).toBeCloseTo(BOWL_CAPACITY_CM3,1);
  expect(await number(page,'displacement')).toBeCloseTo(BOWL_CAPACITY_CM3,1);expect(await number(page,'retained-water')).toBeCloseTo(bowlWaterCapacity(700),1);await page.waitForTimeout(1200);await image(page,'08-bowl-flooded');
  await slider(page,'鐵碗額外載重',0);await expect(page.getByRole('status')).toHaveText('進水沉底');
  await page.getByRole('button',{name:'↺ 重設實驗',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();await expect(page.getByRole('status')).toHaveText('漂浮平衡');
});

test('a flooded bowl responds correctly to upward force and never refills the tank',async({page})=>{
  await page.getByRole('button',{name:'鐵碗',exact:true}).click();await page.getByRole('button',{name:'數值',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  await slider(page,'鐵碗額外載重',700);await slider(page,'鐵碗額外載重',0);
  await slider(page,'向上或向下的外力',-7);await expect(page.getByRole('status')).toHaveText('進水平衡');expect(await number(page,'buoyancy')).toBeCloseTo(11.53,2);
  await slider(page,'向上或向下的外力',-35);await expect(page.getByRole('status')).toHaveText('向上離水');expect(await number(page,'displacement')).toBe(0);expect(await number(page,'collected')).toBeCloseTo(BOWL_CAPACITY_CM3,1);expect(await number(page,'retained-water')).toBeCloseTo(bowlWaterCapacity(),1);
});

test('actual dragging sinks the curved bowl then lifts it full of water with synchronized force',async({page})=>{
  await page.getByRole('button',{name:'鐵碗',exact:true}).click();await page.getByRole('button',{name:'計算',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  await page.waitForTimeout(1800);let p=await samplePoint(page,1.3935);
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x,p.y+170,{steps:15});await page.mouse.up();
  await expect(page.getByRole('status')).toHaveText('定位保持');expect(await number(page,'retained-water')).toBeCloseTo(bowlWaterCapacity(),1);
  expect(await number(page,'external-force-control')).toBeCloseTo(-6.66,2);
  await page.waitForTimeout(1800);p=await samplePoint(page,.4);
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x,p.y-220,{steps:18});await page.mouse.up();
  await expect(page.getByRole('status')).toHaveText('定位保持');expect(await number(page,'displacement')).toBe(0);
  expect(await number(page,'retained-water')).toBeCloseTo(bowlWaterCapacity(),1);
  expect(await number(page,'external-force-control')).toBeCloseTo(-18.53,2);
  expect(await number(page,'external-force')).toBeCloseTo(-await number(page,'weight'),2);
  expect(await number(page,'water-level')).toBeCloseTo(12.13,2);
  const feature=await page.locator('.feature-panel').boundingBox(),condition=await page.locator('.feature-text').boundingBox();
  expect(condition.y+condition.height).toBeLessThanOrEqual(feature.y+feature.height);
  await page.getByRole('button',{name:'數值',exact:true}).click();await page.waitForTimeout(1500);await image(page,'13-bowl-lifted-full');
  await page.getByRole('button',{name:'放開鐵碗',exact:true}).click();await expect(page.getByRole('status')).toHaveText('進水沉底');
  expect(await number(page,'retained-water')).toBeCloseTo(bowlWaterCapacity(),1);expect(await number(page,'external-force-control')).toBe(0);
});

test('help is keyboard accessible and small layouts do not overflow',async({page})=>{
  await page.getByRole('button',{name:'操作說明',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
  for(const width of [1920,1024,768,390,320]){
    await page.setViewportSize({width,height:width===1920?1080:844});
    for(const mode of ['觀察','數值','計算']){
      await page.getByRole('button',{name:mode,exact:true}).click();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    }
  }
  await page.getByRole('button',{name:'觀察',exact:true}).click();await image(page,'09-mobile-320');
});

test.describe('phone touch input',()=>{
 test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 test('touch dragging can submerge and release wood on a phone-sized viewport',async({page,context})=>{
  await page.getByRole('button',{name:'數值',exact:true}).tap();await page.getByRole('button',{name:'放入水中',exact:true}).tap();await page.locator('canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(1800);
  const p=await samplePoint(page,1.5);const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
  for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y+12*i}]});
  await expect(page.getByRole('status')).toHaveText('定位保持');expect(await number(page,'displacement')).toBeCloseTo(1000,1);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.getByRole('status')).toHaveText('定位保持');
  await page.getByRole('button',{name:'放開木塊',exact:true}).tap();await expect(page.getByRole('status')).toHaveText('漂浮平衡');expect(await number(page,'collected')).toBeCloseTo(1000,1);
  await image(page,'10-mobile-touch');
 });
});

test('all objects and information modes run without browser JavaScript errors',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  for(const object of ['木塊','鐵塊','石頭','鐵碗','立鐵碗']){
    await page.getByRole('button',{name:object,exact:true}).click();
    await page.getByRole('button',{name:'放入水中',exact:true}).click();
    for(const mode of ['觀察','數值','計算'])await page.getByRole('button',{name:mode,exact:true}).click();
    await page.getByRole('button',{name:'↺ 重設實驗',exact:true}).click();
  }
  expect(errors).toEqual([]);await expect(page.getByRole('alert')).toHaveCount(0);
});

test('reduced motion preserves results and the settled scene stops requesting frames',async({page})=>{
  await page.addInitScript(()=>{
    const original=window.requestAnimationFrame;
    window.__qaFrameRequests=0;
    window.requestAnimationFrame=function(callback){window.__qaFrameRequests++;return original.call(window,callback);};
  });
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible();
  await page.getByRole('button',{name:'數值',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  expect(await number(page,'displacement')).toBeCloseTo(600,1);
  await page.getByRole('button',{name:'觀察收集量杯',exact:true}).click();await page.getByRole('button',{name:'變形',exact:true}).click();
  await expect(page.getByRole('button',{name:'疊合',exact:true})).toBeEnabled();await page.getByRole('button',{name:'疊合',exact:true}).click();
  await expect(page.locator('.model-note')).toBeVisible();await page.waitForTimeout(1800);
  const before=await page.evaluate(()=>window.__qaFrameRequests);await page.waitForTimeout(1000);
  expect((await page.evaluate(()=>window.__qaFrameRequests))-before).toBeLessThan(5);
});
