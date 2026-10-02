import { mkdir, copyFile, readdir, writeFile } from 'node:fs/promises';
await mkdir('public/ffmpeg/worker', { recursive:true });
await import('./prepare-vtracer.mjs');
for (const name of ['ffmpeg-core.js','ffmpeg-core.wasm']) await copyFile(`node_modules/@ffmpeg/core/dist/esm/${name}`, `public/ffmpeg/${name}`);
for (const name of await readdir('node_modules/@ffmpeg/ffmpeg/dist/esm')) if(name.endsWith('.js')) await copyFile(`node_modules/@ffmpeg/ffmpeg/dist/esm/${name}`,`public/ffmpeg/worker/${name}`);
await writeFile('public/ffmpeg/NOTICE.txt','FFmpeg WebAssembly @ffmpeg/core 0.12.10, GPL-2.0-or-later. Source and build scripts: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10\nFFmpeg source: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/build\n');
