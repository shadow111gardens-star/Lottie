import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const outputDirectory = process.env.RESPONSIVE_OUTPUT || 'artifacts/responsive';
await mkdir(outputDirectory, { recursive: true });
const auth = `export const auth={currentUser:{uid:'responsive-test',displayName:'Responsive Tester'}}; export function getFirebaseAuth(){return auth;} export const db=null;`;
const store = `import {initialScene,makeLayer} from '/src/editor/model.ts';
const scene=initialScene('Responsive test project'); scene.layers=[makeLayer('rect',1)];
const project={id:'responsive-test',owner:'responsive-test',scene,type:'SVG',createdAt:null,editedAt:null,openedAt:null,assets:[]};
export const PROJECTS_CHANGED='kinetic-projects-changed'; export function cachedProjects(){return {projects:[project],invalid:0};}
export function localProject(){return project;} export async function loadProject(){return scene;}
export async function readProjects(){return cachedProjects();} export function sortProjects(p){return p;}
export function editedLabel(){return 'Edited just now';} export async function readUploadedAssets(){return [];}
export async function saveProject(){} export async function preserveDraft(){} export async function frameSvg(){return '';}
export function createBlankProject(){return project;} export async function createProject(){return project.id;}
export async function openProject(){} export async function deleteAsset(id,asset){return globalThis.testDeleteAsset?.(id,asset);}export async function deleteProject(){} export async function duplicateProject(){}
export async function renameProject(){} export async function restoreProject(){} export async function uploadLibraryFile(){}`;
for (const [width,height] of [[320,740],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080],[844,390]]) {
 if (process.env.RESPONSIVE_WIDTHS && !process.env.RESPONSIVE_WIDTHS.split(',').includes(String(width))) continue;
 const page=await browser.newPage({viewport:{width,height}});
 page.on('pageerror',error=>console.error(error.message));
 await page.route(/\/src\/lib\/firebase\.ts(?:\?|$)/,r=>r.fulfill({contentType:'text/javascript',body:auth}));
 await page.route(/\/src\/projects\/store\.ts(?:\?|$)/,r=>r.fulfill({contentType:'text/javascript',body:store}));
 await page.route(/\/node_modules\/\.vite\/deps\/firebase_auth\.js/,r=>r.fulfill({contentType:'text/javascript',body:`export function onAuthStateChanged(a,cb){queueMicrotask(()=>cb(a.currentUser));return ()=>{};} export async function signOut(){} export class GoogleAuthProvider{} export async function signInWithPopup(){} export async function getRedirectResult(){return null;} export async function signInWithRedirect(){}` }));
 for(const route of (process.env.RESPONSIVE_ROUTES?.split(',') || ['/','/privacy','/terms','/dashboard','/editor/responsive-test'])) {
  await page.goto('http://127.0.0.1:5173'+route); await page.waitForTimeout(route==='/'?4000:1000);
  const inspect=async(name)=>{
   const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,canvas:document.querySelector('.ke-canvas-area')?.getBoundingClientRect().toJSON(),overflow:[...document.querySelectorAll('h1,h2,h3,header,nav,input,select,button,.ap-types,.png-actions')].filter(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&s.visibility!=='hidden'&&(r.right>innerWidth+2||r.left< -2)&&!e.closest('.marquee-track,.ke-tracks');}).slice(0,12).map(e=>({tag:e.tagName,class:e.className,text:e.textContent?.slice(0,50)}))}));
   results.push({size:`${width}x${height}`,route:name,...metrics});
   await page.screenshot({path:`${outputDirectory}/${width}-${height}-${name.replace(/\W/g,'_')}.png`,fullPage:true});
  };
  await inspect(route);
  if(route.startsWith('/editor')) {
   await page.locator('.ke-export').scrollIntoViewIfNeeded();
   await inspect('Editor properties');
   await page.getByRole('button',{name:'Start playback',exact:true}).scrollIntoViewIfNeeded();
   await inspect('Editor timeline');
   await page.getByRole('button',{name:'Start playback',exact:true}).click();
   await page.getByRole('button',{name:'Pause playback',exact:true}).click();
  }
  if(route==='/' && width<1024) {
   await page.locator('#pricing').scrollIntoViewIfNeeded();
   await page.getByRole('button',{name:'Open navigation',exact:true}).click();
   assert.ok(await page.getByRole('button',{name:'Get access',exact:true}).last().isVisible());
   await inspect('Mobile navigation');
   await page.getByRole('button',{name:'Close navigation',exact:true}).click();
  }
  if(route==='/dashboard') {
   await page.getByRole('button',{name:'List view',exact:true}).click(); await inspect('Project list');
   await page.getByRole('button',{name:/Filter/}).first().click(); await inspect('Project filters');
   for(const label of ['PNG.*SVG','My assets']) {const b=page.getByRole('button',{name:new RegExp(label,'i')}).first();if(await b.count()){
    await b.click();await page.waitForTimeout(500);await inspect(label);
    if(label==='My assets') {await page.getByRole('button',{name:/^Delete Responsive/}).click();await inspect('Asset delete dialog');const box=await page.getByRole('dialog').boundingBox();assert.ok(box && box.x>=0 && box.x+box.width<=width,'Delete dialog must fit viewport');await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);}
   }}
  }
 }
 await page.close();
}
await browser.close();
await writeFile(`${outputDirectory}/results.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({size,route,scrollWidth,width,canvas,overflow})=>({size,route,overflowWidth:scrollWidth-width,canvasWidth:canvas?.width,overflow})),null,2));
assert.ok(results.every(r=>r.scrollWidth<=r.width+1),'Page must fit viewport');
assert.ok(results.filter(r=>r.canvas).every(r=>r.canvas.width>=200),'Editor canvas must remain usable');
