# Resume Upload Root Cause Report

## Summary

The candidate onboarding resume upload failed because the Next.js API route bundled the `pdf-parse` stack, including `pdfjs-dist` and `@napi-rs/canvas`, into the `/api/parser/pdf` server chunk. That bundled dependency path executed native-canvas DOM geometry property descriptor code and surfaced:

```text
Object.defineProperty called on non-object
```

No first-party upload, response-normalizer, storage, or parser route code was calling `Object.defineProperty(...)` on an API response object. The failure came from the PDF parser dependency path that was activated immediately after selecting a PDF.

## Exact Failing Line

The failing descriptor manipulation line identified in the dependency source is:

```text
node_modules/@napi-rs/canvas/geometry.js:870
Object.defineProperty(DOMMatrix.prototype, propertyName, propertyDescriptor)
```

Related descriptor manipulation in the same dependency:

```text
node_modules/@napi-rs/canvas/geometry.js:108
Object.defineProperty(DOMRect.prototype, propertyName, propertyDescriptor)

node_modules/@napi-rs/canvas/geometry.js:868
const propertyDescriptor = Object.getOwnPropertyDescriptor(DOMMatrix.prototype, propertyName)
```

The app source line that activated this dependency path was:

```text
services/resumeIntelligenceService.ts:443
const parser = new PDFParse({ data: buffer });
```

The API route entry to that parser path was:

```text
app/api/parser/pdf/route.ts:79-80
const { runResumeIntelligencePipeline } = await import('@/services/resumeIntelligenceService');
const result = await runResumeIntelligencePipeline({
```

## Stack Trace

The UI exposed only the message, not a full server process stack. Source and bundle diagnostics identify the failing route call chain as:

```text
TypeError: Object.defineProperty called on non-object
    at Function.defineProperty (<anonymous>)
    at node_modules/@napi-rs/canvas/geometry.js:870:10
    at node_modules/@napi-rs/canvas/index.js
    at pdfjs-dist / pdf-parse dependency initialization
    at extractTextWithPdfParse (services/resumeIntelligenceService.ts:443)
    at runResumeIntelligencePipeline (services/resumeIntelligenceService.ts:495)
    at POST (app/api/parser/pdf/route.ts:80)
```

The important diagnostic proof is that the direct Node parser test succeeded, while the pre-fix Next server bundle included the PDF.js/native-canvas dependency stack in the route chunk. After externalizing the packages, the build artifact no longer embedded that stack and the live upload passed.

## Complete Flow Traced

Candidate upload flow:

```text
src/components/CandidateDashboard.tsx:483-532
File input/drop -> handleFileUpload(file)
  -> FileReader.readAsDataURL(file)
  -> apiFetch('/api/parser/pdf', JSON.stringify({ base64, fileName }))
```

Request normalizer and toast path:

```text
src/components/WorkspaceRuntime.tsx:150-190
apiFetch()
  -> adds Authorization header
  -> fetch(...)
  -> parses JSON text
  -> throws Error(payload.error || payload.message || status)
  -> shows "Request failed" toast on non-silent errors
```

Parser route:

```text
app/api/parser/pdf/route.ts
POST
  -> rate limit
  -> getCurrentUser(request)
  -> request.json()
  -> base64 data URL prefix stripping
  -> get/create candidate profile
  -> optional Gemini layer
  -> runResumeIntelligencePipeline(...)
  -> uploadResumeToStorage(...)
  -> updateProfile(...)
  -> jsonOk(result)
```

Parser service:

```text
services/resumeIntelligenceService.ts
runResumeIntelligencePipeline(...)
  -> Buffer.from(base64Data, 'base64')
  -> assertPdf(buffer)
  -> optional Gemini layer
  -> extractTextWithPdfParse(buffer)
  -> regex/entity extraction
  -> buildAutofillResult(...)
```

Storage helper:

```text
lib/storage/uploads.ts:107-110
uploadResumeToStorage(userId, profileId, fileName, buffer)
  -> bucket = resumes
  -> path = userId/profileId/timestamp-fileName
  -> uploadBufferToStorage(..., 'application/pdf')
```

## Occurrence Audit

Command audited:

```text
rg -n "Object\\.defineProperty|defineProperty\\(|Object\\.assign\\(|structuredClone\\(|Object\\.defineProperties|Object\\.getOwnPropertyDescriptor|Reflect\\.defineProperty" app src services lib next.config.ts -g "!node_modules"
```

Result after fix:

```text
No first-party matches.
```

Before the fix, the only first-party matches in the resume path were `Object.assign(new Error(...), ...)` in `services/resumeIntelligenceService.ts`. Those were not the thrown `Object.defineProperty` error, but they were removed to eliminate descriptor-adjacent error mutation in the parser path.

Dependency matches:

```text
node_modules/@napi-rs/canvas/geometry.js:106
node_modules/@napi-rs/canvas/geometry.js:108
node_modules/@napi-rs/canvas/geometry.js:868
node_modules/@napi-rs/canvas/geometry.js:870
```

Response-adjacent spreads and object transforms were reviewed in:

```text
src/components/WorkspaceRuntime.tsx
src/components/CandidateDashboard.tsx
app/api/parser/pdf/route.ts
lib/http/responses.ts
lib/storage/uploads.ts
services/logger.ts
```

No first-party code did this:

```text
Object.defineProperty(response, ...)
Object.defineProperty(data, ...)
Object.defineProperty(error, ...)
Object.defineProperty(parsedResume, ...)
```

## Payload, Body Parsing, and Response Shape

Payload:

```text
The onboarding upload does not use FormData.
It sends JSON:
{
  base64: "data:application/pdf;base64,...",
  fileName: file.name
}
```

File object integrity:

```text
CandidateDashboard checks file type/name for PDF.
FileReader.readAsDataURL(file) preserves the file as a data URL.
The API strips the data URL prefix before Buffer.from(base64Data, 'base64').
```

API route body parsing:

```text
request.json().catch(() => ({}))
base64 is required.
fileName falls back to "resume.pdf".
```

Response shape:

```text
Current app contract is raw JSON, not a { success, data } envelope.
jsonOk(result) returns the parser result object directly.
jsonError(status, message, extra) returns { error, ...extra }.
```

This was intentionally preserved because `CandidateDashboard` expects top-level `text`, `parsed`, `autofill`, and `parser` fields. Changing every API response to `{ success, data }` would be a broad contract change outside this root-cause fix.

## Root Cause

`pdf-parse` is safe when run as a normal Node package in this repo, but it was unsafe when bundled into the Next.js API route chunk. The bundled route pulled PDF.js/native-canvas initialization into the server chunk, including `@napi-rs/canvas/geometry.js`, where DOM geometry property descriptors are rewritten with `Object.defineProperty(...)`.

That dependency descriptor code is what matched the observed failure after selecting a PDF. The previous DOMMatrix patch addressed availability of DOMMatrix-like APIs, but it did not prevent Next from bundling the parser/native-canvas stack into the route.

## Fix Applied

### Before

```ts
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(process.cwd()),
  experimental: {},
};
```

### After

```ts
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(process.cwd()),
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@napi-rs/canvas'],
  experimental: {},
};
```

This keeps `pdf-parse`, `pdfjs-dist`, and `@napi-rs/canvas` external in the server runtime instead of inlining them into the Next route chunk.

### Error Helper Cleanup

Before:

```ts
throw Object.assign(new Error('Invalid PDF file. Please upload a readable PDF document.'), { statusCode: 400 });
```

After:

```ts
throw createResumePipelineError('Invalid PDF file. Please upload a readable PDF document.', 400);
```

The helper preserves the same `statusCode`, `warnings`, and `errors` behavior without using `Object.assign(...)` in the parser error path.

### Route Error Response Cleanup

Before:

```ts
return Response.json({
  error: message,
  warnings: Array.isArray(errorLike.warnings) ? errorLike.warnings : undefined,
  errors: Array.isArray(errorLike.errors) ? errorLike.errors : undefined,
}, { status });
```

After:

```ts
return jsonError(status, message, {
  warnings: Array.isArray(errorLike.warnings) ? errorLike.warnings : undefined,
  errors: Array.isArray(errorLike.errors) ? errorLike.errors : undefined,
});
```

The error response payload stays unchanged.

## Bundle Verification

After the fix, the production route bundle shows `pdf-parse` as an external dynamic import:

```text
.next/server/app/api/parser/pdf/route.js -> chunk 8254
.next/server/chunks/8254.js -> module 80526: a.exports = import("pdf-parse")
```

The large pre-fix embedded PDF.js/native-canvas chunk was removed from the parser route bundle.

## Live Upload Verification

Final live smoke target:

```text
http://127.0.0.1:3030
```

Steps executed:

```text
POST /api/auth/register
POST /api/parser/pdf
GET /api/candidates/:id
Supabase storage list for the returned resumes bucket prefix
```

Payload shape matched the UI:

```json
{
  "base64": "data:application/pdf;base64,...",
  "fileName": "codex-upload-final-smoke.pdf"
}
```

Final live result:

```text
candidate register: 200
candidate resume upload: 200
candidate profile after upload: 200
parser primaryLayer: pdf-parse
parser layersAttempted: gemini, pdf-parse, regex
parser textLength: 290
parsed skills: Node.js, React, SQL, TypeScript
storage object found in resumes bucket: true
profile resumeFileName persisted: codex-upload-final-smoke.pdf
profile resumeText persisted: true
profile resumeUrl present: true
onboardingContinues: true
Object.defineProperty error present: false
```

Gemini returned a temporary upstream `503` during smoke, but the local PDF parser succeeded and the route correctly continued through storage and profile persistence.

The in-app Browser surface was unavailable in this session, so the final user-interface click could not be driven through the browser plugin. The live API smoke used the exact data URL payload and route invoked by the onboarding file input.

## Required Validation

```text
npm.cmd run lint
PASS

npm.cmd run build
PASS

npm.cmd run test:resume
PASS
```

Additional direct parser verification:

```text
runResumeIntelligencePipeline synthetic PDF
PASS
primaryLayer: pdf-parse
skills: Node.js, React, SQL
```

## Files Changed

```text
next.config.ts
services/resumeIntelligenceService.ts
app/api/parser/pdf/route.ts
RESUME_UPLOAD_ROOT_CAUSE_REPORT.md
```
