import { initialScene, makeLayer, type MediaSequence, type Scene } from '../editor/model';
import { importSvg } from '../editor/importSvg';
import { vectorizePng } from '../editor/pngToSvg';
import { exportSceneSvg } from '../editor/io';
import { dataUrl } from './storage';
export type AnimatorLogo={name:string;source:string;preview:string;scene:Scene;traced:boolean;flattened:boolean};
const decode=(source:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('This logo could not be decoded. Choose another PNG, JPG or SVG.'));image.src=source;});
async function raster(source:string,max=1024){const image=await decode(source);if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth>8192||image.naturalHeight>8192||image.naturalWidth*image.naturalHeight>16000000)throw new Error('Use a logo up to 16 megapixels and 8192 pixels per side.');const canvas=document.createElement('canvas');const scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const context=canvas.getContext('2d');if(!context)throw new Error('Image conversion is unavailable.');context.drawImage(image,0,0,canvas.width,canvas.height);return {image:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height};}
function compactTracedPaths(layers:Scene['layers']):Scene['layers']{
 const compact:Scene['layers']=[];
 for(const layer of layers){
  const previous=compact[compact.length-1];
  const mergeable=(item:typeof layer)=>item.type==='path'&&item.visible&&item.opacity===100&&item.scaleX===100&&item.scaleY===100&&item.rotation===0&&item.skewX===0&&!item.sourceFrame&&!Object.keys(item.tracks).length;
  if(previous&&mergeable(previous)&&mergeable(layer)&&previous.fill===layer.fill&&previous.fillOpacity===layer.fillOpacity&&previous.stroke===layer.stroke&&previous.strokeOpacity===layer.strokeOpacity&&previous.strokeWidth===layer.strokeWidth&&previous.fillRule===layer.fillRule){
   const a=(previous.pathViewBox||`${previous.x} ${previous.y} ${previous.width} ${previous.height}`).trim().split(/[\s,]+/).map(Number);
   const b=(layer.pathViewBox||`${layer.x} ${layer.y} ${layer.width} ${layer.height}`).trim().split(/[\s,]+/).map(Number);
   if(a.length===4&&b.length===4&&[...a,...b].every(Number.isFinite)){
    const left=Math.min(a[0],b[0]),top=Math.min(a[1],b[1]),right=Math.max(a[0]+a[2],b[0]+b[2]),bottom=Math.max(a[1]+a[3],b[1]+b[3]);
    compact[compact.length-1]={...previous,name:'Combined logo paths',x:left,y:top,width:right-left,height:bottom-top,path:`${previous.path} ${layer.path}`,pathViewBox:`${left} ${top} ${right-left} ${bottom-top}`};
    continue;
   }
  }
  compact.push(layer);
 }
 return compact;
}
export async function prepareAnimatorLogo(file:File,progress:(message:string)=>void,signal:AbortSignal):Promise<AnimatorLogo>{
 if(!file.size||file.size>8*1024*1024)throw new Error('Choose a PNG, JPG or SVG logo up to 8 MB.');
 const signature=new Uint8Array(await file.slice(0,8).arrayBuffer());
 const png=signature.every((value,i)=>value===[137,80,78,71,13,10,26,10][i])&&signature.length===8;
 const jpeg=signature[0]===255&&signature[1]===216&&signature[2]===255;
 const svg=/\.svg$/i.test(file.name)||file.type==='image/svg+xml';
 if(!png&&!jpeg&&!svg)throw new Error('Upload a valid PNG, JPG or SVG logo.');
 let source=await dataUrl(file),scene:Scene|undefined,traced=false,flattened=false,rasterImage:Awaited<ReturnType<typeof raster>>|undefined;
 if(svg&&!png&&!jpeg){
   const text=await file.text();const doc=new DOMParser().parseFromString(text,'image/svg+xml');
   if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg')throw new Error('This SVG is invalid.');
   if(doc.querySelector('script,foreignObject,iframe,object,embed,animate,animateTransform,set')||/<!ENTITY|@import/i.test(text)||[...doc.querySelectorAll('*')].some(el=>[...el.attributes].some(a=>/^on/i.test(a.name)||(/(?:href|src)$/i.test(a.name)&&!a.value.startsWith('#'))||(/url\s*\(/i.test(a.value)&&!/url\(\s*['"]?#/.test(a.value)))))throw new Error('Use a self-contained still SVG without scripts or external resources.');
   source=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
   // Complex SVG styles are flattened before tracing; basic shapes keep their paths.
   if(!doc.querySelector('style,text,linearGradient,radialGradient,filter,mask,clipPath,use,image,[transform],[style],[opacity],[fill-rule="evenodd"],[fill-opacity],[stroke-opacity],[stroke-dasharray],[stroke-linecap],[stroke-linejoin],g[stroke-width]')){
     const shapeCount=doc.querySelectorAll('path,rect,circle,ellipse,line,polygon,polyline,text').length;
     if(shapeCount>0&&shapeCount<=500)scene={...initialScene(file.name),layers:importSvg(text,file.name).reverse()};
   }
 }
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 if(!scene){progress('Preparing logo for editable vector animation…');rasterImage=await raster(source);const output=await vectorizePng(rasterImage.image,file.name,rasterImage.width,rasterImage.height,progress,signal);scene=output.scene;traced=true;}
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 const layers=scene.layers.filter(layer=>layer.visible&&layer.opacity>0&&((layer.fill!=='none'&&layer.fill!=='transparent'&&layer.fillOpacity>0)||(layer.stroke!=='none'&&layer.strokeWidth>0)));
 let usableLayers=traced?compactTracedPaths(layers):layers;
 if(!usableLayers.length)throw new Error('No visible logo shapes were found. Choose another PNG, JPG or SVG.');
 if(usableLayers.length>500){
  rasterImage??=await raster(source,960);
  const media:MediaSequence={sourceName:file.name,kind:'video',width:rasterImage.width,height:rasterImage.height,timeBase:'1/1',duration:3,frames:[{id:'ai-logo-still',number:1,timestamp:0,duration:3,pts:'0',durationTicks:'3',image:rasterImage.image}]};
  usableLayers=[makeLayer('media',{name:file.name,media,x:0,y:0,width:rasterImage.width,height:rasterImage.height,startTime:0,endTime:3})];
  flattened=true;
 }
 const left=Math.min(...usableLayers.map(l=>l.x)),top=Math.min(...usableLayers.map(l=>l.y)),width=Math.max(...usableLayers.map(l=>l.x+l.width))-left,height=Math.max(...usableLayers.map(l=>l.y+l.height))-top;
 const scale=Math.min(680/Math.max(1,width),680/Math.max(1,height));
 scene={...scene,name:file.name.replace(/\.[^.]+$/,''),width:960,height:960,duration:3,background:'transparent',files:{source:[{name:file.name,data:source}]},layers:usableLayers.map(l=>({...l,x:(l.x-left)*scale+(960-width*scale)/2,y:(l.y-top)*scale+(960-height*scale)/2,width:l.width*scale,height:l.height*scale,strokeWidth:l.strokeWidth*scale,radius:l.radius*scale,pathViewBox:l.pathViewBox?`${(parseFloat(l.pathViewBox.split(/[\s,]+/)[0])-left)*scale+(960-width*scale)/2} ${(parseFloat(l.pathViewBox.split(/[\s,]+/)[1])-top)*scale+(960-height*scale)/2} ${parseFloat(l.pathViewBox.split(/[\s,]+/)[2])*scale} ${parseFloat(l.pathViewBox.split(/[\s,]+/)[3])*scale}`:l.pathViewBox,tracks:{}}))};
 const preview=await raster(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(exportSceneSvg(scene,0,false))}`,512);
 return {name:file.name,source,scene,preview:preview.image,traced,flattened};
}
