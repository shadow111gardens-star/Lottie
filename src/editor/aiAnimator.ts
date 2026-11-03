import { uid, type Scene, type Keyframe, type Property } from './model';
import { validateScene } from './io';
import { validateAnimationPlan, type AnimationPlan } from '../../shared/animation-plan.mjs';

/** Compile data-only AI instructions into ordinary, editable Vekto keyframes. */
export function animateLogo(source: Scene, input: AnimationPlan): Scene {
  const plan = validateAnimationPlan(input);
  const scene = structuredClone(validateScene(source));
  if (!scene.layers.length || scene.layers.some(l=>l.lottie)) throw new Error('Upload a still logo.');
  scene.name=plan.title;scene.duration=plan.duration;scene.fps=30;
  scene.background=plan.background==='white'?'#ffffff':plan.background==='dark'?'#0f172a':'transparent';
  const cx=scene.width/2,cy=scene.height/2;
  // A bounded stagger keeps dense PNG traces from running past the duration.
  const step=Math.min(plan.stagger,plan.duration*0.25/Math.max(1,scene.layers.length-1));
  scene.layers=scene.layers.map((layer,index)=>{
    const delay=index*step, end=plan.duration*(plan.loop?0.78:1), span=end-delay;
    const tracks: typeof layer.tracks = {};
    const keys=(property:Property,values:[number,number][])=>{
      const frames:Keyframe[]=values.map(([t,value])=>({id:uid(),time:delay+t*span,value,easing:'ease'}));
      if(delay>0)frames.unshift({id:uid(),time:0,value:frames[0].value,easing:'hold'});
      if(plan.loop)frames.push({id:uid(),time:plan.duration,value:frames[0].value,easing:'ease'});
      tracks[property]=frames;
    };
    const groupTransform=(frames:[number,number,number][])=>{
      keys('x',frames.map(([t,s,a])=>[t,cx+s*((layer.x-cx)*Math.cos(a)-(layer.y-cy)*Math.sin(a))]));
      keys('y',frames.map(([t,s,a])=>[t,cy+s*((layer.x-cx)*Math.sin(a)+(layer.y-cy)*Math.cos(a))]));
      keys('scaleX',frames.map(([t,s])=>[t,layer.scaleX*s]));keys('scaleY',frames.map(([t,s])=>[t,layer.scaleY*s]));
      keys('rotation',frames.map(([t,,a])=>[t,layer.rotation+a*180/Math.PI]));
    };
    const strength=plan.intensity;
    if(plan.effect==='pulse')groupTransform([[0,1,0],[0.5,1+0.1*strength,0],[1,1,0]]);
    else if(plan.effect==='spin')groupTransform([[0,0.8, -Math.PI*(0.2+strength*0.8)],[0.7,1,0],[1,1,0]]);
    else if(plan.effect==='bounce')groupTransform([[0,0.4+0.3*(1-strength),0],[0.5,1+0.12*strength,0],[0.72,1-0.06*strength,0],[1,1,0]]);
    if(plan.effect==='slide'){
      const distance=Math.min(scene.width,scene.height)*(0.1+0.25*strength);
      keys('x',[[0,layer.x+(plan.direction==='left'?-distance:plan.direction==='right'?distance:0)],[0.7,layer.x],[1,layer.x]]);
      keys('y',[[0,layer.y+(plan.direction==='up'?-distance:plan.direction==='down'?distance:0)],[0.7,layer.y],[1,layer.y]]);
    }
    if(plan.effect!=='pulse')keys('opacity',[[0,0],[0.45,layer.opacity],[1,layer.opacity]]);
    return {...layer,startTime:undefined,endTime:undefined,tracks};
  });
  return validateScene(scene);
}
