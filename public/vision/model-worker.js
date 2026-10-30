// Experimental on-device inference. Image pixels never leave this page.
const MODEL = 'onnx-community/Florence-2-base-ft';
let loaded;
function progress(value) {
  const pct = typeof value.progress === 'number' ? Math.round(value.progress) : null;
  self.postMessage({type:'progress', message: pct === null ? 'Downloading and preparing local model…' : 'Preparing model… ' + pct + '%'});
}
async function prepare(device) {
  if (loaded?.device === device) return loaded;
  self.postMessage({type:'progress', message:'Loading on-device vision runtime…'});
  const lib = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm');
  const dtype = device === 'webgpu'
    ? {embed_tokens:'fp16', vision_encoder:'fp16', encoder_model:'q4', decoder_model_merged:'q4'}
    : {embed_tokens:'q8', vision_encoder:'q8', encoder_model:'q8', decoder_model_merged:'q8'};
  const model = await lib.Florence2ForConditionalGeneration.from_pretrained(MODEL, {
    device, dtype, progress_callback: progress
  });
  const processor = await lib.AutoProcessor.from_pretrained(MODEL);
  loaded = { device, lib, model, processor };
  return loaded;
}
self.onmessage = async ({data}) => {
  if (data?.type !== 'analyze') return;
  try {
    const {lib,model,processor} = await prepare(data.device);
    self.postMessage({type:'progress',message:'Analyzing image on this device…'});
    const image = await lib.RawImage.fromURL(data.image);
    const task = data.mode === 'ocr' ? '<OCR>' : '<MORE_DETAILED_CAPTION>';
    // Florence-2's processor prepares BOTH image and text; it also owns token decoding.
    const prompts = processor.construct_prompts(task);
    const inputs = await processor(image, prompts);
    const ids = await model.generate({...inputs,max_new_tokens:data.mode === 'ocr' ? 320 : 180});
    const decoded = processor.batch_decode(ids, {skip_special_tokens:false})[0];
    const result = processor.post_process_generation(decoded, task, image.size)[task];
    const answer = typeof result === 'string' ? result : JSON.stringify(result,null,2);
    self.postMessage({type:'result', text:answer || 'No readable output found. Try another photo.'});
  } catch (error) {
    self.postMessage({type:'error',message:error instanceof Error ? error.message : String(error)});
  }
};