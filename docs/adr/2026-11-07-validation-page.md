# Validation page

Date: 2026-11-07

## Problem

Validation shipped in fastapi-startkit (the async-first `FormRequest`, `Validated[...]` for query strings and bodies, chainable `Field` rules, `authorize`/`prepare_for_validation`/`after` hooks, and the Laravel-style 422 response), but the docs had no page for it. Readers had to learn it from the tests, and the response rules for failed `GET` requests without `Accept: application/json` (a 303 redirect, not a 422) weren't written down anywhere.

## Alternatives

1. **One Validation page in the Digging Deeper group, ordered like Laravel's Validation docs (chosen).** Quickstart first (form request, route, failed response, query strings), then how rules run, the rule reference, custom messages, custom rules, hooks, the `Validator`, multiple form requests, `validate_input`, error responses and `MessageBag`. It sits in Digging Deeper after Authentication, alongside the other request-level features.
2. **A section on the FastAPI page.** Rejected: the feature is large enough that it would bury the routing content, and readers look for "Validation" by name.
3. **Split pages (form requests, rules, responses).** Rejected: the parts are short and reference each other constantly.

## Design

`docs/validation.md`, linked from the Digging Deeper sidebar after Authentication. Every rule in the table, message, placeholder, hook, `Validator` attribute and response shape comes from `fastapi_startkit/src/fastapi_startkit/validation/` and `fastapi/exceptions.py` on framework `main` (0.74.0). The page covers:

- `FastAPIProvider` as the prerequisite for 422 responses; the database rules need a connection.
- Query-string input for `GET`/`HEAD`/`OPTIONS`/`DELETE` (coercion, repeated keys for sequence fields, aliases, ignored keys, OpenAPI query parameters), and body input for writes with query parameters merged underneath; the missing-body error.
- The two passes (Pydantic types, then rules), first failing rule per field, empty values skipping non-implicit rules, `stop_on_first_failure`, and the nested-model restriction.
- Every `Field` method with its default message; size semantics for strings, numbers and lists; `nullable`/`required_if`; `unique` (with `ignore`) and `exists`.
- `msg=` and `.msg()`, callable messages, and the placeholders.
- `Rule`/`AsyncRule` subclasses and `using()` closures.
- Hook order, `AuthorizationException` → 403, `validator.merge`, and `after` errors; what `validator.data` holds at each stage; typed path parameters as context.
- Embedded bodies for multiple form requests (snake-case class name keys, prefixed errors).
- `validate_input` outside a request.
- Content negotiation: Inertia redirect, 422 JSON when `Accept` or `Content-Type` is JSON, otherwise session flash + 303 to a same-origin `Referer` or `/`; the consequence for `GET` requests; `RequestValidationError` using the same handler.
- `MessageBag` methods and raising `ValidationException` directly.

## Validation

- A scratch script outside both repos built every example on the page into a FastAPI app with `FastAPIProvider` (SQLite for `unique`/`exists`) on framework `main` and compared each response with the page: 55 checks passed. A second script checked the session flash and Inertia redirects, aliases, query/body merging, plain Pydantic bodies, `Rule("...")` messages, size messages and raising `ValidationException`.
- `npm run docs:build` succeeds.
- No framework source was changed.
