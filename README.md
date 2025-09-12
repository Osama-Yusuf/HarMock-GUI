# HAR → Mock Server MVP

Local-only, single-repo, no auth, no DB. Upload a HAR and get a mock API at `/m/{mockId}`. Two modes: sequence and endpoint. Delay simulation optional. Suites runner included.

## Run

```bash
# dev (server on :3000, Vite on :5173, backend proxies frontend)
npm install
npm run dev
# open http://localhost:3000

# prod
npm run build
npm run start
# open http://localhost:3000
```

## Use

1. Upload a `.har` file on the page.
2. Copy the Mock Root URL and try an endpoint via the example curl.
3. Toggle mode and delay as needed.
4. Select entries → Create Suite → downloads `suite.json`.
5. Run the suite against any target base URL:

```bash
npm run suite -- --target http://localhost:3000 --suite ./suite.json
```

A JUnit report writes to `./suite-report.xml`.

## API

* `POST /api/mocks` (multipart file) → `{ mockId }`
* `GET /api/mocks/:mockId`
* `PATCH /api/mocks/:mockId` `{ mode, simulateDelay }`
* `GET /api/mocks/:mockId/entries?path=&method=&status=`
* `GET /api/mocks/:mockId/entries/:entryId`
* `POST /api/mocks/:mockId/suites` `{ name, entryIds }` → `{ suiteId }`
* `GET /api/mocks/:mockId/suites/:suiteId`
* `ALL /m/:mockId/*` replay

## Matching

* Tier 1 Exact: method + path + exact normalized query + header fingerprint
* Tier 2 Relaxed: ignores volatile query keys (`_t, cache, cacheBust, cb`) and allows subset
* Tier 3 Path-only
* Winner = highest tier, then smallest `orderIdx`.

## Redaction

* Drop headers: `cookie, authorization, set-cookie`.
* JSON bodies: redact keys by `/password|token|email|phone|card|cvv|ssn/i` → `"REDACTED"`.
* Only scrubbed versions are served.

## Tests

```bash
npm -w server run test
```

## Notes

* Binary bodies are replayed; preview uses base64 in UI when non-JSON.
* In sequence mode the server issues `X-Mock-Session` if missing and advances per session.
* For HARs with non-API assets, sequence mode may 404 out-of-sequence if requests are skipped.


