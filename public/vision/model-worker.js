// No images leave this worker. Only pinned model/runtime files are downloaded on demand.
const MODEL='onnx-community/Florence-2-base-ft';
let loaded;
function progress(value){const percent=typeof value.progress==='number'?Math.round(value.progress):null;self.postMessage({type:'progress',message:percent===null?'Downloading and preparing local model…':('Preparing model… '+percent+'%')});}
async function prepare(device){
  if(loaded && loaded.device===device)return loaded;
  self.postMessage({type:'progress',message:'Loading on-device vision runtime…'});
  const lib=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm');
  const model=await lib.Florence2ForConditionalGeneration.from_pretrained(MODEL,{device,dtype:device==='webgpu'?'q4':'q8',progress_callback:progress});
  const processor=await lib.AutoProcessor.from_pretrained(MODEL,{progress_callback:progress});
  loaded={device,lib,model,processor};
  return loaded;
}
self.onmessage=async({data})=>{
  if(!data || data.type!=='analyze')return;
  try{
    const {lib,model,processor}=await prepare(data.device);
    self.postMessage({type:'progress',message:'Analyzing the image locally…'});
    const image=await lib.RawImage.fromURL(data.image);
    const task=data.mode==='ocr'?'<OCR>':'<MORE_DETAILED_CAPTION>';
    const inputs=await processor(image,processor.construct_prompts(task));
    const ids=await model.generate({...inputs,max_new_tokens:data.mode==='ocr'?320:180});
    const decoded=processor.batch_decode(ids,{skip_special_tokens:false})[0];
    const parsed=processor.post_process_generation(decoded,task,image.size);
    const value=parsed[task];
    const answer=typeof value==='string'?value:JSON.stringify(value,null,2);
    self.postMessage({type:'result',text:answer||'No readable output found. Try another photo.'});
  }catch(e){self.postMessage({type:'error',message:e instanceof Error?e.message:String(e)});}
};