# Validation page: file uploads, JSON-only bodies and testing

Date: 2026-11-09

## Problem

`docs/validation.md` (see [Validation page](2026-11-07-validation-page.md)) describes framework 0.74.0. Since then, framework PR #364 (released in v0.75.1) lets a `FormRequest` with an `UploadFile` field read `multipart/form-data` bodies, and adds the `file()` and `extensions()` rules and kilobyte sizes for uploads. The page didn't cover uploads. It also didn't explain why a form request refuses form-encoded bodies, which framework ADRs 053 and 075 describe as a CSRF safeguard, and it had no testing section.

## Alternatives

1. **Extend the existing page (chosen).** Uploads, body handling and testing sit next to the rules and responses they depend on. The page keeps its Laravel-style order.
2. **A separate "File Uploads" page.** Rejected. Uploads reuse the rules, messages and responses on the validation page, and a second page would repeat them.
3. **Put the testing examples on the FastAPI Testing page.** Rejected. They're specific to validation errors, and that page already links `HttpTestCase` usage in general.

## Design

All content comes from `fastapi_startkit/validation/` and `fastapi/exceptions.py` on framework `main` (v0.75.1, `da3ecc14`) and framework ADRs 053 and 075.

- **Validating Request Bodies** (new subsection of Quickstart): the existing JSON-body paragraph, plus a caution that declared fields can be set from the query string on write routes.
- **JSON-Only Bodies**: urlencoded, multipart and `text/plain` bodies fail with the `""` error before `authorize` runs. It explains the CSRF reasoning (forms can send those types without a CORS preflight; JSON can't), why a body-less write doesn't fall back to the query, and why `DELETE` reads the query.
- **Rules**: `file()` and `extensions()` in the rule table, uploads in the size table (kilobytes), `:values` placeholder, and an upload without a file name counting as empty.
- **File Uploads** (after Multiple Form Requests): the `UploadFile` annotation as the only switch, form field mapping, the upload's lifetime, file rules, optional and multiple files, the empty-file-input `UploadFile` with an empty `filename`, what such a request accepts (multipart on a single-form-request route, JSON, not urlencoded), the `Accept: application/json` requirement for API clients, OpenAPI, and protecting upload routes with CSRF tokens or `SameSite` cookies.
- **Testing**: `HttpTestCase` with `assert_json(exact=...)` and a multipart upload test, and `validate_input` unit tests with `pytest.raises`.

`accepts_form_bodies` isn't mentioned. It only existed in unreleased commits of PR #364 and was never in a release.

## Validation

- A scratch app outside both repos defined every new example on the page with `FastAPIProvider` on framework `main` (`da3ecc14`). 16 pytest checks ran through `HttpTestCase` and passed: the testing section's own tests, the JSON-only 422 for urlencoded, multipart and `text/plain`, the query merge on `PATCH`, the upload success and failure bodies, the 512 KB limit at the boundary, the gallery failure body, empty browser file inputs (sent as raw multipart, because httpx drops an empty filename), JSON and urlencoded bodies on an upload route, the 303 without `Accept`, `[".PDF"]` and `Annotated` uploads, and the OpenAPI body and binary field.
- Two claims were corrected during verification. Starlette's `UploadFile` can't be used as the annotation (pydantic can't build its schema), so the page names FastAPI's. A route with two `Validated` parameters rejects multipart with `Field required` per embed key, so the page limits multipart to a single form request.
- `npm run docs:build` succeeds.
- No framework source was changed.
