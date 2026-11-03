import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Upload, KeyRound, ArrowUpRight, Download, LoaderCircle, X } from 'lucide-react';
import { providers, validateAnimationPlan, type AnimationPlan } from '../../shared/animation-plan.mjs';
import { animateLogo } from '../editor/aiAnimator';
import { animateFacialFeatures } from '../editor/facialAnimator';
import { exportSceneSvg } from '../editor/io';
import { exportLottie } from '../editor/lottie';
import { getFirebaseAuth } from '../lib/firebase';
import { createProject } from '../projects/store';
import { prepareAnimatorLogo, type AnimatorLogo } from './ai-logo-input';
import './ai-animator.css';
const suggestions=['Smooth logo reveal with a gentle bounce and a seamless loop.','A premium, subtle fade-in. Transparent background. No loop.','Slide my logo up slowly, then hold it still.','A playful spin reveal with a soft landing.'];
export default function AiAnimator(){
 const navigate=useNavigate();const picker=useRef<HTMLInputElement>(null);const request=useRef<AbortController|null>(null);const version=useRef(0);const working=useRef(false);
 const [logo,setLogo]=useState<AnimatorLogo|null>(null),[prompt,setPrompt]=useState(''),[provider,setProvider]=useState<keyof typeof providers>('openai'),[model,setModel]=useState(providers.openai.model),[key,setKey]=useState(''),[plan,setPlan]=useState<AnimationPlan|null>(null),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const [replay,setReplay]=useState(0);
 const [animation,setAnimation]=useState<ReturnType<typeof animateLogo>|null>(null);const [preview,setPreview]=useState('');
 useEffect(()=>()=>{version.current++;request.current?.abort();},[]);
 const cancel=()=>{version.current++;request.current?.abort();working.current=false;setBusy(false);setStatus('Cancelled. You can try again.');};
 const select=async(file?:File)=>{if(!file||working.current||saving)return;working.current=true;setBusy(true);setError('');setStatus('Reading your logo…');setLogo(null);setPlan(null);setAnimation(null);setPreview('');const id=++version.current,controller=new AbortController();request.current=controller;try{const result=await prepareAnimatorLogo(file,message=>{if(id===version.current)setStatus(message);},controller.signal);if(id!==version.current)return;setLogo(result);setStatus(result.flattened?'Detailed logo ready as one animated image layer.':`${result.scene.layers.length} editable vector shapes ready.`);}catch(cause){if(id===version.current)setError(cause instanceof Error?cause.message:'Could not read this logo.');}finally{if(id===version.current){working.current=false;setBusy(false);}}};
 const generate=async()=>{
   if(!logo||!key.trim()||!prompt.trim()||working.current||saving)return;
   const user=getFirebaseAuth().currentUser;if(!user){setError('Sign in again to generate your animation.');return;}
   const id=++version.current,controller=new AbortController();request.current=controller;working.current=true;setBusy(true);setError('');setStatus('Asking your AI provider to design the animation…');
   const timeout=setTimeout(()=>controller.abort(),55000);
   try{
     const response=await fetch('/api/ai-animator',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await user.getIdToken()}`,'X-Vekto-AI-Key':key.trim()},body:JSON.stringify({provider,model:model.trim(),prompt:prompt.trim(),image:logo.preview,previous:plan}),signal:controller.signal,cache:'no-store'});
     const result=await response.json();if(!response.ok)throw new Error(result.error||'Animation generation failed.');
     if(id!==version.current||controller.signal.aborted||getFirebaseAuth().currentUser?.uid!==user.uid)return;
     const next=validateAnimationPlan(result.plan);if(/\b(eyes?|blink|wink|mouth|lips?|speak|talk|talking|face|facial)\b/i.test(prompt)&&!next.facialMotion.enabled)throw new Error('I could not isolate the requested facial features. Use a clear, front-facing portrait and ask for eye or mouth movement.');let scene=animateLogo(logo.scene,next);if(next.facialMotion.enabled)scene=await animateFacialFeatures(scene,logo.preview,next.facialMotion);let svg=exportSceneSvg(scene,0,true);if(!next.loop)svg=svg.split('repeatCount="indefinite"').join('repeatCount="1" fill="freeze"');
     setPlan(next);setAnimation(scene);setPreview(svg);setStatus('Your animated logo is ready. Refine it with another prompt or open it in the editor.');
   }catch(cause){if(id===version.current)setError(controller.signal.aborted?'Generation timed out. Retry when your provider is available.':cause instanceof Error?cause.message:'Could not generate this animation.');}
   finally{clearTimeout(timeout);if(id===version.current){working.current=false;setBusy(false);}}
 };
 const download=(format:'svg'|'json')=>{if(!animation)return;const blob=new Blob([format==='svg'?preview:JSON.stringify(exportLottie(animation),null,2)],{type:format==='svg'?'image/svg+xml':'application/json'});const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`${animation.name.replace(/[^\p{L}\p{N}_-]/gu,'-')||'animated-logo'}.${format}`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const open=async()=>{if(!animation||saving||working.current)return;working.current=true;setSaving(true);setError('');try{const id=await createProject(animation.name,animation);navigate(`/editor/${encodeURIComponent(id)}`);}catch(cause){setError(cause instanceof Error?cause.message:'Could not save your animation.');working.current=false;setSaving(false);}};
 return <div className="ai-tool">
  <header className="ai-heading"><div className="ai-eyebrow"><Sparkles size={14}/>TOOLS · AI ANIMATOR <span>NEW</span></div><h1>Your logo.<br/><em>In motion.</em></h1><p>Upload your logo, describe the movement, and bring it to life with your own AI.</p></header>
  <div className="ai-layout"><section className="ai-controls" aria-label="AI animation inputs">
   <div className="ai-section-label"><span>01</span><h2>Add your logo</h2></div>
   <input ref={picker} type="file" hidden accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" aria-label="Upload logo" disabled={busy||saving} onChange={e=>{void select(e.currentTarget.files?.[0]);e.currentTarget.value='';}}/>
   <button type="button" className="ai-upload" aria-busy={busy&&!logo} disabled={busy||saving} onClick={()=>picker.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void select(e.dataTransfer.files[0]);}}>{logo?<><img src={logo.preview} alt="Prepared logo"/><strong>{logo.name}</strong><span>Click to replace</span></>:<><Upload size={28}/><strong>{busy?'Preparing your logo…':'Drop your logo here'}</strong><span>{busy?status:'or click to upload · SVG, PNG, JPG · Up to 8 MB'}</span></>}</button>
   {!logo&&(busy||error)&&<div className="ai-upload-feedback" aria-live="polite">{busy&&<p role="status"><LoaderCircle size={14} className="ai-spin"/>{status||'Preparing your logo…'}</p>}{error&&<p role="alert" className="ai-error">{error}</p>}</div>}
   {logo?.flattened&&<p className="ai-note">This detailed artwork stays as a raster base; requested eye and mouth movements are added as separate animated layers.</p>}
   {logo?.traced&&!logo.flattened&&<p className="ai-note">This image was traced into editable vectors. Fine details and colors may differ slightly.</p>}
   <div className="ai-section-label"><span>02</span><h2>Connect your AI</h2><KeyRound size={16}/></div>
   <div className="ai-provider-row"><label>Provider<select value={provider} disabled={busy||saving} onChange={e=>{const value=e.target.value as keyof typeof providers;setProvider(value);setModel(providers[value].model);setKey('');}}>{Object.entries(providers).map(([id,item])=><option key={id} value={id}>{item.name}</option>)}</select></label><label>Model ID<input aria-label="AI model ID" value={model} onChange={e=>setModel(e.target.value)} maxLength={100} disabled={busy||saving}/></label></div>
   <label className="ai-key-label">Your API key<div className="ai-key"><input aria-label="Your AI API key" type="password" autoComplete="off" spellCheck={false} value={key} placeholder="Paste your provider API key" onChange={e=>setKey(e.target.value)} disabled={busy||saving}/><button type="button" aria-label="Clear API key" disabled={busy||!key} onClick={()=>setKey('')}><X size={15}/></button></div></label>
   <p className="ai-note">Your key is kept in this tab’s memory only and sent through Vekto to your selected provider. It is not saved to your account or project. Generating sends your logo preview and prompt to this provider. Your provider bills API usage.</p>
   <div className="ai-section-label"><span>03</span><h2>Describe the movement</h2></div>
   <label className="ai-prompt-label"><span className="sr-only">Animation prompt</span><textarea aria-label="Animation prompt" value={prompt} maxLength={2000} disabled={busy||saving} onChange={e=>setPrompt(e.target.value)} placeholder="Make a smooth logo reveal with a gentle bounce. Keep my colors and use a transparent background." rows={4}/></label>
   <div className="ai-suggestions">{suggestions.map(text=><button type="button" key={text} disabled={busy||saving} onClick={()=>setPrompt(text)}>{text.split('.')[0]}</button>)}</div>
   <button type="button" className="ai-generate" disabled={!logo||!prompt.trim()||!key.trim()||!model.trim()||busy||saving} onClick={()=>void generate()}>{busy?<LoaderCircle size={18} className="ai-spin"/>:<Sparkles size={18}/>} {busy?'Working…':plan?'Refine animation':'Generate animation'}</button>
   {busy&&<button type="button" className="ai-cancel" onClick={cancel}>Cancel</button>}
   <p role="status" aria-live="polite" className="ai-status">{logo?status:''}</p>{logo&&error&&<p role="alert" className="ai-error">{error}</p>}
  </section><section className="ai-result" aria-label="Animated logo result"><div className="ai-result-top"><div><span className="ai-eyebrow">LIVE PREVIEW</span><h2>{plan?.title||'A little motion. A big impression.'}</h2></div>{plan&&<span className="ai-ready">Ready</span>}</div>
   <div className={`ai-canvas ${plan?.background==='dark'?'is-dark':''}`}>{preview?<img key={replay} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview)}`} alt="Animated logo preview"/>:<div className="ai-empty"><Sparkles size={38}/><strong>Your animated logo will appear here</strong><span>Upload a logo and describe how it should move.</span></div>}</div>
   <div className="ai-result-description">{plan?<><p>{plan.description}</p><span>{plan.duration}s · {plan.effect} · {plan.loop?'Looping':'One play'} · Editable keyframes</span><button type="button" disabled={busy} onClick={()=>setReplay(value=>value+1)}>Replay preview</button></>:<p>Fade, slide, bounce, spin, and pulse animations. Keep refining in your own words.</p>}</div>
   <div className="ai-exports"><button type="button" disabled={!animation||busy} onClick={()=>download('svg')}><Download size={15}/>Animated SVG</button><button type="button" disabled={!animation||busy} onClick={()=>download('json')}><Download size={15}/>Lottie JSON</button><button type="button" disabled={!animation||busy||saving} className="ai-open" onClick={()=>void open()}><ArrowUpRight size={15}/>{saving?'Saving project…':'Open in Editor'}</button></div>
   <p className="ai-note">Opening in the editor creates one project and uses one Free project trial. Generating a preview does not use a project trial. Lottie looping is controlled by your player.</p>
  </section></div>
 </div>;
}
