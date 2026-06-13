# PDF Parser Fix Report

## Audit

Endpoint:

- `POST /api/parser/pdf`

File:

- `server.ts`

Environment variable used:

- `GEMINI_API_KEY`

The server loads environment variables through:

```ts
import "dotenv/config";
```

## Root Cause

The parser was using `process.env.GEMINI_API_KEY` and passing it directly to `GoogleGenAI`.

The current configured key is present, but Google rejects it as invalid. The previous endpoint allowed the raw provider error to bubble back as an internal parser failure.

The endpoint also logged the API key to the console, which has been removed.

## Changes Made

Added Gemini key validation helpers:

- Missing key detection
- Suspicious key format detection
- Provider auth error detection
- Quota/rate-limit error detection

New controlled responses:

```json
{ "error": "Gemini API key missing" }
```

```json
{ "error": "Gemini API key invalid" }
```

```json
{ "error": "Gemini API quota exceeded" }
```

```json
{ "error": "Gemini PDF extraction failed" }
```

Added startup validation:

- Warns if `GEMINI_API_KEY` is missing.
- Warns if `GEMINI_API_KEY` is present but does not match expected Google AI Studio key format.
- Confirms when a key with expected format is detected.

## Verification

Local login succeeded and returned a valid candidate user id.

Parser endpoint test:

```http
POST http://127.0.0.1:3000/api/parser/pdf
```

Result with current configured key:

```http
503
```

```json
{ "error": "Gemini API key invalid" }
```

This confirms:

- The endpoint is reachable.
- Authentication header flow works.
- Raw Google `API_KEY_INVALID` errors are no longer exposed.
- The current configured key still needs to be replaced with a valid Gemini API key before AI resume extraction can succeed.

## Remaining Action

Replace `GEMINI_API_KEY` in `.env` with a valid Google AI Studio Gemini API key. After that, retry PDF upload from the candidate profile flow to verify successful text extraction.

## Files Changed

- `server.ts`
- `PDF_PARSER_FIX_REPORT.md`
