import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestVisualTags,validateVisionDraft,createVisionDraft} from '../public/vision/visual-tags.js';
test('only creates tags from visible controlled vocabulary',()=>{
 assert.deepEqual(suggestVisualTags('A mobile dashboard with a color palette and CSS layout'),['design','color','css','dashboard','mobile']);
 assert.deepEqual(suggestVisualTags('secrets unknown financial OCR numbers'),[]);
});
test('rejects malformed and expired session drafts',()=>{
 const draft=createVisionDraft('A screenshot of a React dashboard','react, dashboard, react',100_000);
 assert.deepEqual(draft?.tags,['react','dashboard']);
 assert.equal(validateVisionDraft(draft,100_000+16*60*1000),null);
 assert.equal(createVisionDraft('ok','<script>',100_000)?.tags.length,0);
});
