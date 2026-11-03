import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { createAiAnimatorApi, providerRequest } from '../server/ai-animator.mjs';
import { providers, validateAnimationPlan } from '../shared/animation-plan.mjs';
const noFace={enabled:false,blink:false,speak:false,eyes:{x:0,y:0,width:0,height:0},mouth:{x:0,y:0,width:0,height:0}};
const plan={title:'Brand reveal',description:'A gentle bounce with a clean transparent finish.',effect:'bounce',direction:'up',duration:3,intensity:0.5,stagger:0,loop:true,background:'transparent',facialMotion:noFace};
const output=new URL(`./.ai-animation-${process.pid}.mjs`,import.meta.url);
const bundle=await build({stdin:{contents:'export {animateLogo} from "./src/editor/aiAnimator";export {initialScene,makeLayer,evaluate} from "./src/editor/model";export {exportSceneSvg} from "./src/editor/io";export {exportLottie} from "./src/editor/lottie";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',packages:'external',write:false});
await writeFile(output,bundle.outputFiles[0].text);
let upstream=[];let mode='ok';let resolveWait;
const key='test-only-customer-key';
const bytes=Buffer.alloc(33);Buffer.from('89504e470d0a1a0a','hex').copy(bytes);bytes.writeUInt32BE(512,16);bytes.writeUInt32BE(512,20);const image='data:image/png;base64,'+bytes.toString('base64');
const app=createAiAnimatorApi({verify:async token=>{if(token!=='user')throw Error('Invalid');return {uid:'test-owner'};},authorize:async()=>{},fetch:async(url,request)=>{
 upstream.push({url,request});if(mode==='wait')await new Promise(resolve=>{resolveWait=resolve;});
 if(mode==='bad-key')return new Response(JSON.stringify({error:{message:key}}),{status:401});
 if(mode==='model-not-found')return new Response(JSON.stringify({error:{message:'model unavailable'}}),{status:404});
 if(mode==='malformed')return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'{"effect":"eval","code":"secret"}'}]}]}));
 const text=JSON.stringify(plan);
 return new Response(JSON.stringify(url.includes('anthropic')?{content:[{type:'text',text}]}:url.includes('googleapis')?{candidates:[{content:{parts:[{text}]}}]}:{output:[{content:[{type:'output_text',text}]}]}));
}});
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const call=(body={},headers={})=>fetch(origin+'/api/ai-animator',{method:'POST',headers:{Authorization:'Bearer user','Content-Type':'application/json','X-Vekto-AI-Key':key,...headers},body:JSON.stringify({provider:'openai',model:'gpt-4.1-mini',prompt:'Animate my logo with a soft bounce',image,...body})});
try{
 const api=await import(output.href);const base={...api.initialScene('Brand'),width:960,height:960,background:'transparent',layers:[api.makeLayer('rect',{x:220,y:300,width:220,height:120,fill:'#ff0088'}),api.makeLayer('ellipse',{x:520,y:340,width:80,height:80,fill:'#7700ff'})]};const original=JSON.stringify(base);
 assert.equal(providers.gemini.model,'gemini-3.8-flash','Gemini defaults to a current model with structured output access');
 for(const effect of ['fade','slide','bounce','spin','pulse']){
   const scene=api.animateLogo(base,{...plan,effect});assert.equal(JSON.stringify(base),original,'Never mutate uploaded base logo');assert.equal(scene.layers[0].fill,'#ff0088');assert.equal(scene.duration,3);assert.ok(Object.keys(scene.layers[0].tracks).length>0);
   const start=api.evaluate(scene.layers[0],0),mid=api.evaluate(scene.layers[0],1),end=api.evaluate(scene.layers[0],3);
   assert.notDeepEqual([start.x,start.y,start.scaleX,start.opacity,start.rotation],[mid.x,mid.y,mid.scaleX,mid.opacity,mid.rotation]);
   assert.deepEqual([end.x,end.y,end.scaleX,end.opacity,end.rotation],[start.x,start.y,start.scaleX,start.opacity,start.rotation],'Loop seam matches');
   const svg=api.exportSceneSvg(scene,0,true);assert.match(svg,/<animate/);assert.ok(!svg.includes('<script'));assert.equal(api.exportLottie(scene).layers.length,2);
 }
 const held=api.animateLogo(base,{...plan,loop:false});assert.equal(api.evaluate(held.layers[0],3).opacity,base.layers[0].opacity);
 for(const value of [{...plan,duration:Infinity},{...plan,intensity:-1},{...plan,effect:'eval'},{...plan,code:'alert(1)'},null])assert.throws(()=>validateAnimationPlan(value));
 assert.equal((await call({}, {Authorization:''})).status,401);assert.equal(upstream.length,0);
 assert.equal((await call({}, {'X-Vekto-AI-Key':''})).status,400);assert.equal(upstream.length,0);
 assert.equal((await call({provider:'http://evil.test'})).status,400);
 assert.equal((await call({image:'https://evil.test/logo.png'})).status,400);
 assert.equal((await call({prompt:'x'.repeat(2001)})).status,400);
 assert.equal((await call({model:'../../other-service'})).status,400);
 for(const provider of ['openai','anthropic','gemini']){
   const response=await call({provider,previous:plan});assert.equal(response.status,200);assert.deepEqual(await response.json(),{plan});
   const sent=upstream.at(-1);assert.ok(!sent.url.includes(key));assert.ok(!sent.request.body.includes(key));assert.equal(sent.request.redirect,'error');assert.ok(sent.request.signal);
   const config=providerRequest(provider,'test-model',key,'prompt',image,plan);assert.ok(Object.values(config.headers).some(value=>value.includes(key)));assert.ok(!config.url.includes('evil'));
 }
 mode='bad-key';const rejected=await call();assert.equal(rejected.status,400);assert.ok(!(await rejected.text()).includes(key),'Provider error body cannot expose credentials');
 mode='model-not-found';const unavailable=await call({provider:'gemini'});assert.equal(unavailable.status,400);assert.match((await unavailable.json()).error,/Use gemini-3\.8-flash/);
 mode='malformed';assert.equal((await call()).status,502);
 mode='wait';const pending=call();while(!resolveWait)await new Promise(r=>setTimeout(r,5));assert.equal((await call()).status,429);mode='ok';resolveWait();assert.equal((await pending).status,200);
 console.log('PASS AI Animator: editable motion/effects, logo preservation, loop seams, SVG/Lottie output, invalid-model plan rejection, authenticated BYOK, fixed provider hosts, three provider adapters, no key echo/persistence and concurrent request protection');
}finally{await unlink(output).catch(()=>{});await new Promise(resolve=>server.close(resolve));}
