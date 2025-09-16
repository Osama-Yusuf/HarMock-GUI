# 🚀 Harmock

Transform HAR files into powerful mock APIs with a beautiful web interface. Perfect for development, testing, and API prototyping.

## ✨ Features

- 🎯 **Drag & Drop HAR Upload** - Simply drop your HAR files to create instant mock APIs
- 🌙 **Beautiful Dark Mode UI** - Modern interface with theme switching
- ⚡ **Real-time Load Time Display** - See actual request timings from your HAR files
- 🔍 **Advanced Search & Filtering** - Find endpoints quickly with method and path search
- 📊 **Sortable Tables** - Click column headers to sort by method, path, status, or timing
- 🎛️ **Collapsible Sections** - Organize large HAR files with toggleable sections
- 💾 **Session Persistence** - Your uploads are saved locally for quick access
- 🔄 **Two Mock Modes** - Sequence mode for workflows, endpoint mode for individual calls
- ⏱️ **Realistic Delay Simulation** - Simulate actual network delays from HAR timings
- 📋 **One-click Copy** - Copy curl commands and mock URLs with visual confirmation
- 🧪 **Test Suite Generation** - Create and run test suites from selected requests

## 🚀 Quick Start

### Installation

```bash
npm install -g harmock-gui
```

### Usage

```bash
# Start the server
npx harmock-gui

# Or run locally
harmock-gui
```

Open http://localhost:5173 and start uploading HAR files!

### Development

```bash
# Clone and install
git clone https://github.com/Osama-Yusuf/HarMock
cd HarMock
npm install

# Development mode
npm run dev

# Production build
npm run build
npm start
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

## Notes

* Binary bodies are replayed; preview uses base64 in UI when non-JSON.
* In sequence mode the server issues `X-Mock-Session` if missing and advances per session.
* For HARs with non-API assets, sequence mode may 404 out-of-sequence if requests are skipped.


