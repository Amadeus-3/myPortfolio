import { writeFile, mkdir } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createOmarCharacter } from '../src/characterModel.ts';
// GLTFExporter uses the browser FileReader API for its binary buffer.
globalThis.FileReader = class {
  result = null;
  onloadend = null;
  onerror = null;
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result=result; this.onloadend?.(); }).catch(error=>this.onerror?.(error)); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }).catch(error=>this.onerror?.(error)); }
};
const result=await new GLTFExporter().parseAsync(createOmarCharacter(),{binary:true});
await mkdir('public/models',{recursive:true});
await writeFile('public/models/omar-toy-head.glb',Buffer.from(result));
console.log(`Exported editable character: ${Math.round(result.byteLength/1024)} KB`);
