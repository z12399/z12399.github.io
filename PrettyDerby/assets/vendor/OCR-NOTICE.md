# Local OCR assets

PrettyDerby vendors a narrow browser build of Tesseract.js so screenshot recognition can run locally and can remain absent from the initial page load.

- `tesseract.js` and `tesseract.js-core`: version `7.0.0`, Apache-2.0; the package license files are preserved beside the assets.
- `@tesseract.js-data/chi_tra` and `@tesseract.js-data/eng`: version `1.0.0`, `4.0.0_best_int` data. Package metadata declares MIT; the upstream Tesseract trained-data Apache-2.0 license is also preserved.
- Source package integrity and per-file SHA-256 values are recorded in `ocr-assets.json`.

The application loads these files only after the user starts screenshot recognition. The selected image stays in the browser; it is not sent to an OCR service. OCR output remains an unconfirmed draft until the user reviews every retained factor row.
