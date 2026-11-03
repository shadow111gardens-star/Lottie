import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { Window } from 'happy-dom';
const win=new Window();globalThis.DOMParser=win.DOMParser;
const output=new URL(`./.ai-logo-validation-${process.pid}.mjs`,import.meta.url);
const bundle=await build({entryPoints:['src/projects/ai-logo-input.ts'],bundle:true,platform:'node',format:'esm',packages:'external',write:false,plugins:[{name:'source-read',setup(builder){builder.onResolve({filter:/^\.\/storage$/},()=>({path:'storage',namespace:'validation'}));builder.onLoad({filter:/.*/,namespace:'validation'},()=>({contents:'export async function dataUrl(){return "data:image/svg+xml;base64,PHN2Zy8+";}'}));}}]});await writeFile(output,bundle.outputFiles[0].text);
try{
 const {prepareAnimatorLogo}=await import(output.href);const signal=new AbortController().signal;
 await assert.rejects(()=>prepareAnimatorLogo(new File(['not an image'],'bad.png'),()=>{},signal),/valid PNG/);
 await assert.rejects(()=>prepareAnimatorLogo(new File([],'empty.svg'),()=>{},signal),/up to 8 MB/);
 for(const body of ['<script>alert(1)</script>','<foreignObject><div>unsafe</div></foreignObject>','<image href="https://evil.example/logo.png"/>','<rect onload="alert(1)"/>','<style>@import "https://evil.example/style.css";</style>']){
   await assert.rejects(()=>prepareAnimatorLogo(new File([`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`],'unsafe.svg',{type:'image/svg+xml'}),()=>{},signal),/without scripts or external resources/);
 }
 console.log('PASS Logo validation: invalid/empty uploads and active/external SVG content rejected before decode or provider calls');
}finally{await unlink(output);await win.happyDOM.abort();}
