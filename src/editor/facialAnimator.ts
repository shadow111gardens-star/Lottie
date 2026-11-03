import { makeLayer, uid, type Keyframe, type Scene } from './model';
import type { FacialMotion } from '../../shared/animation-plan.mjs';
import { validateScene } from './io';

const readImage=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Could not prepare the face layers. Try uploading the logo again.'));image.src=src;});
const faceTrack=(duration:number,values:[number,number][]):Keyframe[]=>values.map(([progress,value])=>({id:uid(),time:progress*duration,value,easing:'ease'}));
function imageLayer(name:string,image:string,x:number,y:number,width:number,height:number,duration:number){
 const frameTicks=Math.max(1,Math.round(duration*30));
 return makeLayer('media',{name,x,y,width,height,media:{sourceName:name,kind:'video',width:Math.max(1,Math.round(width)),height:Math.max(1,Math.round(height)),timeBase:'1/30',duration,frames:[{id:uid(),number:1,timestamp:0,duration,pts:'0',durationTicks:String(frameTicks),image}]}});
}
function sampleSkin(context:CanvasRenderingContext2D,x:number,y:number,width:number,height:number){
 const canvas=context.canvas, samples:number[][]=[];
 const add=(px:number,py:number)=>{if(px<0||py<0||px>=canvas.width||py>=canvas.height)return;const pixel=context.getImageData(Math.floor(px),Math.floor(py),1,1).data;if(pixel[3]>160)samples.push([pixel[0],pixel[1],pixel[2]]);};
 const count=12;
 for(let i=0;i<=count;i++){const t=i/count;add(x+t*width,y-2);add(x+t*width,y+height+1);add(x-2,y+t*height);add(x+width+1,y+t*height);}
 if(!samples.length)return '#f4c9aa';
 const rgb=[0,1,2].map(channel=>Math.round(samples.reduce((sum,pixel)=>sum+pixel[channel],0)/samples.length));
 return `rgb(${rgb.join(',')})`;
}
function crop(source:HTMLImageElement,x:number,y:number,width:number,height:number){
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width));canvas.height=Math.max(1,Math.round(height));
 const context=canvas.getContext('2d');if(!context)throw new Error('Image conversion is unavailable.');
 context.drawImage(source,x,y,width,height,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/png');
}

/** Split face regions out of a still portrait and animate them as independent image/vector layers. */
export async function animateFacialFeatures(scene:Scene,preview:string,motion:FacialMotion):Promise<Scene>{
 if(!motion.enabled)return scene;
 const source=await readImage(preview),scale=Math.min(scene.width/source.naturalWidth,scene.height/source.naturalHeight),offsetX=(scene.width-source.naturalWidth*scale)/2,offsetY=(scene.height-source.naturalHeight*scale)/2;
 const canvas=document.createElement('canvas');canvas.width=source.naturalWidth;canvas.height=source.naturalHeight;const context=canvas.getContext('2d');if(!context)throw new Error('Image conversion is unavailable.');context.drawImage(source,0,0);
 const sceneBox=(box:FacialMotion['eyes'])=>({sx:box.x*source.naturalWidth,sy:box.y*source.naturalHeight,sw:box.width*source.naturalWidth,sh:box.height*source.naturalHeight,x:offsetX+box.x*source.naturalWidth*scale,y:offsetY+box.y*source.naturalHeight*scale,width:box.width*source.naturalWidth*scale,height:box.height*source.naturalHeight*scale});
 const eyes=motion.blink?sceneBox(motion.eyes):null,mouth=motion.speak?sceneBox(motion.mouth):null;
 for(const box of [eyes,mouth])if(box){const padding=Math.max(1,Math.round(Math.min(box.sw,box.sh)*0.04));const x=Math.max(0,box.sx-padding),y=Math.max(0,box.sy-padding),right=Math.min(canvas.width,box.sx+box.sw+padding),bottom=Math.min(canvas.height,box.sy+box.sh+padding);context.fillStyle=sampleSkin(context,x,y,right-x,bottom-y);context.fillRect(x,y,right-x,bottom-y);}
 const patched=canvas.toDataURL('image/png'),fitWidth=source.naturalWidth*scale,fitHeight=source.naturalHeight*scale;
 const layers=[imageLayer('Portrait base',patched,offsetX,offsetY,fitWidth,fitHeight,scene.duration)];
 if(eyes){const originalCrop=crop(source,eyes.sx,eyes.sy,eyes.sw,eyes.sh);const blink=[[0,100],[0.08,100],[0.11,8],[0.15,100],[0.48,100],[0.51,8],[0.55,100],[0.8,100],[0.83,8],[0.87,100],[1,100]] as [number,number][];const eye=imageLayer('Blinking eyes',originalCrop,eyes.x,eyes.y,eyes.width,eyes.height,scene.duration);eye.tracks.scaleY=faceTrack(scene.duration,blink);layers.push(eye);layers.push(makeLayer('path',{name:'Vector eyelids',x:eyes.x,y:eyes.y,width:eyes.width,height:eyes.height,path:'M 4 50 Q 25 72 46 50 M 54 50 Q 75 72 96 50',pathViewBox:'0 0 100 100',fill:'none',stroke:'#4a2b20',strokeWidth:5,lineCap:'round',tracks:{opacity:faceTrack(scene.duration,[[0,0],[0.095,0],[0.12,100],[0.145,0],[0.495,0],[0.53,100],[0.57,0],[0.815,0],[0.85,100],[0.885,0],[1,0]])}}));}
 if(mouth){
  const talk=faceTrack(scene.duration,[[0,10],[0.08,50],[0.17,92],[0.26,24],[0.36,78],[0.45,12],[0.55,100],[0.65,30],[0.75,84],[0.86,16],[0.94,66],[1,10]]);
  const mouthPath='M 5 50 C 18 18 78 18 95 50 C 78 82 20 82 5 50 Z';
  layers.push(makeLayer('path',{name:'Speaking mouth',x:mouth.x,y:mouth.y,width:mouth.width,height:mouth.height,path:mouthPath,pathViewBox:'0 0 100 100',fill:'#542027',stroke:'#a95550',strokeWidth:4,lineJoin:'round',tracks:{scaleY:talk}}));
  layers.push(makeLayer('path',{name:'Mouth teeth',x:mouth.x+mouth.width*0.2,y:mouth.y+mouth.height*0.28,width:mouth.width*0.6,height:mouth.height*0.28,path:'M 4 4 Q 50 -2 96 4 L 90 28 Q 50 23 10 28 Z',pathViewBox:'0 0 100 32',fill:'#fff0dc',stroke:'none',strokeWidth:0,tracks:{scaleY:talk,opacity:faceTrack(scene.duration,[[0,0],[0.08,35],[0.17,90],[0.26,18],[0.36,70],[0.45,10],[0.55,100],[0.65,24],[0.75,82],[0.86,12],[0.94,58],[1,0]])}}));
 }
 return validateScene({...scene,layers});
}
