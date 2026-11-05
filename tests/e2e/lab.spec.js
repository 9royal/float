import {test,expect} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {mkdir} from 'node:fs/promises';

async function slider(page,name,value){
  const input=page.getByRole('slider',{name,exact:true});
  const min=Number(await input.getAttribute('min')),max=Number(await input.getAttribute('max')),step=Number(await input.getAttribute('step'));
  const fromEnd=Math.abs(max-value)<Math.abs(value-min);
  await input.press(fromEnd?'End':'Home');
  for(let i=0;i<Math.round(Math.abs(value-(fromEnd?max:min))/step);i++)await input.press(fromEnd?'ArrowLeft':'ArrowRight');
}
const number=async(page,id)=>Number((await page.getByTestId(id).innerText()).replace(/[^\d.\-]/g,''));
async function image(page,name){await mkdir('qa',{recursive:true});await page.screenshot({path:`qa/${name}.png`,fullPage:true});}
async function samplePoint(page,y){
  const box=await page.locator('canvas').boundingBox();
  const camera=new PerspectiveCamera(36,box.width/box.height,.1,80);
  camera.position.set(6.7,3.65,7.7);camera.lookAt(.2,1.13,0);camera.updateMatrixWorld();
  const point=new Vector3(-1.05,y,0).project(camera);
  return {x:box.x+(point.x+1)*box.width/2,y:box.y+(1-point.y)*box.height/2};
}

test.beforeEach(async({page})=>{
  await page.goto('/');await expect(page.getByRole('button',{name:'放入水中',exact:true})).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible();
});

test('observation starts without answers and has one selector and action per function',async({page})=>{
  await expect(page.locator('.results-panel,.equation,.control-number')).toHaveCount(0);
  for(const name of ['木塊','鐵塊','石頭','鐵碗'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(1);
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

test('actual pointer dragging and release preserve overflow and lower the waterline',async({page})=>{
  await page.getByRole('button',{name:'數值',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  // Wait for the illustrative transition to settle before hit testing the mesh.
  await page.waitForTimeout(1800);
  const p=await samplePoint(page,1.5);
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x,p.y+150,{steps:12});
  await expect(page.getByRole('status')).toHaveText('手動控制');expect(await number(page,'displacement')).toBeCloseTo(1000,1);
  await page.mouse.up();await expect(page.getByRole('status')).toHaveText('漂浮平衡');
  expect(await number(page,'collected')).toBeCloseTo(1000,1);expect(await number(page,'displacement')).toBeCloseTo(600,1);expect(await number(page,'water-level')).toBeCloseTo(15.33,2);
  await page.getByRole('button',{name:'觀察收集量杯',exact:true}).click();await expect(page.getByRole('button',{name:'返回實驗操作',exact:true})).toBeVisible();
  await expect(page.locator('.model-note')).toHaveCount(0);await image(page,'03-release-no-return');
});

test('keyboard depth control releases on keyup',async({page})=>{
  await page.getByRole('button',{name:'計算',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  await page.locator('.stage').focus();for(let i=0;i<24;i++)await page.keyboard.down('ArrowDown');
  expect(await number(page,'displacement')).toBeCloseTo(1000,1);expect(await number(page,'hand-force')).toBeCloseTo(3.92,2);await page.keyboard.up('ArrowDown');
  expect(await number(page,'displacement')).toBeCloseTo(600,1);expect(await number(page,'collected')).toBeCloseTo(1000,1);
});

test('iron shows bottom support, sufficient lifting force, and a fresh liquid experiment',async({page})=>{
  await page.getByRole('button',{name:'鐵塊',exact:true}).click();await page.getByRole('button',{name:'計算',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  expect(await number(page,'support')).toBeCloseTo(66.64,2);expect(await number(page,'buoyancy')).toBeCloseTo(9.8,2);
  await page.waitForTimeout(1200);await image(page,'04-iron-support');
  await slider(page,'向上或向下的外力',-70);expect(await number(page,'support')).toBe(0);expect(await number(page,'displacement')).toBeLessThan(1000);
  await slider(page,'液體密度',1.2);expect(await number(page,'collected')).toBeCloseTo(await number(page,'displacement'),1);
});

test('stone and iron equal-volume overlays preserve the physical cup and align at the bottom',async({page})=>{
  await page.getByRole('button',{name:'石頭',exact:true}).click();await page.getByRole('button',{name:'數值',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  expect(await number(page,'displacement')).toBeCloseTo(1000,1);
  await page.locator('.stage').press('r');await page.getByRole('button',{name:'觀察收集量杯',exact:true}).click();await page.getByRole('button',{name:'變形與疊合',exact:true}).click();
  await expect(page.locator('.model-note')).toBeVisible();await page.waitForTimeout(5500);expect(await number(page,'collected')).toBeCloseTo(1000,1);await image(page,'05-stone-overlay');
  await page.getByRole('button',{name:'鐵塊',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();await page.getByRole('button',{name:'觀察收集量杯',exact:true}).click();await page.getByRole('button',{name:'變形與疊合',exact:true}).click();
  await page.waitForTimeout(5500);await image(page,'06-iron-overlay');
});

test('bowl is hollow, carries cargo, floods and requires reset to become dry again',async({page})=>{
  await page.getByRole('button',{name:'鐵碗',exact:true}).click();await page.getByRole('button',{name:'數值',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  expect(await number(page,'displacement')).toBeCloseTo(780,1);await page.waitForTimeout(1200);await image(page,'07-bowl-floating');
  await slider(page,'鐵碗額外載重',700);await expect(page.getByRole('status')).toHaveText('進水沉底');expect(await number(page,'collected')).toBeCloseTo(1231.5,1);
  expect(await number(page,'displacement')).toBeCloseTo(189.7,1);await page.waitForTimeout(1200);await image(page,'08-bowl-flooded');
  await slider(page,'鐵碗額外載重',0);await expect(page.getByRole('status')).toHaveText('進水沉底');
  await page.getByRole('button',{name:'↺ 重設實驗',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();await expect(page.getByRole('status')).toHaveText('漂浮平衡');
});

test('a flooded bowl responds correctly to upward force and never refills the tank',async({page})=>{
  await page.getByRole('button',{name:'鐵碗',exact:true}).click();await page.getByRole('button',{name:'數值',exact:true}).click();await page.getByRole('button',{name:'放入水中',exact:true}).click();
  await slider(page,'鐵碗額外載重',700);await slider(page,'鐵碗額外載重',0);
  await slider(page,'向上或向下的外力',-7);await expect(page.getByRole('status')).toHaveText('進水平衡');expect(await number(page,'buoyancy')).toBeCloseTo(.64,2);
  await slider(page,'向上或向下的外力',-18);await expect(page.getByRole('status')).toHaveText('向上離水');expect(await number(page,'displacement')).toBe(0);expect(await number(page,'collected')).toBeCloseTo(1231.5,1);
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
  await expect(page.getByRole('status')).toHaveText('手動控制');expect(await number(page,'displacement')).toBeCloseTo(1000,1);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.getByRole('status')).toHaveText('漂浮平衡');expect(await number(page,'collected')).toBeCloseTo(1000,1);
  await image(page,'10-mobile-touch');
 });
});

test('all objects and information modes run without browser JavaScript errors',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  for(const object of ['木塊','鐵塊','石頭','鐵碗']){
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
  await page.getByRole('button',{name:'觀察收集量杯',exact:true}).click();await page.getByRole('button',{name:'變形與疊合',exact:true}).click();
  await expect(page.locator('.model-note')).toBeVisible();await page.waitForTimeout(1800);
  const before=await page.evaluate(()=>window.__qaFrameRequests);await page.waitForTimeout(1000);
  expect((await page.evaluate(()=>window.__qaFrameRequests))-before).toBeLessThan(5);
});
