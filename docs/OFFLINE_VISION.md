# Experimental on-device vision preview

This route is a **limited, opt-in technical prototype**, not a verified production feature.

Open `/vision/index.html` or the small in-app link. Select a JPEG, PNG or WebP image (up to 10 MB), choose **Describe visible content** or **Extract visible text**, and confirm **Analyze on this device**. There is no automatic download when entering the page, and no automatic action or database write.

## nest use case

Screenshot descriptions and visible text. Copy the result into bookmark notes or tags; bookmarks and sync remain untouched.

## Privacy and network boundary

- Uploaded image bytes remain in the browser. A local canvas downsizes the selected image; a Web Worker performs inference. Nothing in this implementation POSTs images or sends them to the application's server.
- On first analysis, the browser imports **Transformers.js 3.8.1** from jsDelivr and downloads **onnx-community/Florence-2-base-ft** model files from Hugging Face. These providers see download requests/IP information, not the selected photo from our code.
- The model is **not bundled** into the application or installed automatically. The model/runtime CDN is a future supply-chain dependency; review licensing, pin full revision hashes and self-host assets before production.
- A narrowly scoped `/vision/sw.js` caches the local visual assistant and eligible model/runtime fetches only when the `/vision/` page is under its control. After initial registration, reopen that page **before** first model download. Browser eviction, unsupported GPU/CPU backends, model/CDN fetch behavior and storage quotas can prevent complete offline operation.
- Image and model are held in memory during analysis. Cancel terminates the Worker. The model is not allowed to write to application data; the only output operation is an explicitly requested clipboard copy. Removing site data clears caches.

## Verification required before merging

1. Run the repository's existing lint, typecheck, build, unit and relevant Playwright checks, where configured. The new public files should not disrupt application startup.
2. Open `/vision/index.html` on a real **desktop Chrome WebGPU** device and on **iOS Safari**. Verify that the page renders, selects a camera image and previews it; no model request should occur before Analyze.
3. Download the model on an eligible browser and test both caption and OCR on synthetic fixtures. Test CPU mode; benchmark time, peak RAM, battery and storage, and confirm graceful unsupported-device errors.
4. Reopen the page once under the nested service worker, warm the model, disconnect from the network and rerun. Record complete/partial offline success separately. Do not claim offline support on untested devices.
5. Check no image uploads occur using browser Network logs; test cancel, 10 MB rejection, nonimage file rejection, keyboard navigation, reduced motion, browser back navigation and cache eviction.
6. Review outputs against source images, especially digits, handwriting, dates and currencies. Never accept model extraction as authoritative evidence.

## Known limitations

- **Preview only:** No automatic domain-specific record updates, recipe matching, bookmark tagging, submission, or linked evidence annotation. Those need careful integration with the existing workflows.
- Captions and OCR can hallucinate or omit information. This is not an accredited OCR, medical, property, vehicle-safety or legal/compliance evaluation system.
- The pinned CDN ESM import and model-specific generation APIs need real-device integration testing. No passing runtime, end-to-end or offline inference test is asserted by this PR.
- Offline model downloads are large and must remain user-initiated. The service worker cache uses device storage and may be evicted.
