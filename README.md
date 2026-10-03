# scoped-event-log

Scoped TypeScript Log provides a typed logging utility for JavaScript/TypeScript projects. All events logged by the utility require a named scope, which can be used to filter and remove events.

## Usage

### Install via NPM
```shell
npm i -S scoped-event-log
```

### Import in JavaScript
```javascript
import { Log } from 'scoped-event-log'
Log.add("DEBUG", "This is a logged debug event.", "scope")
// Or using a shorthand:
Log.debug("This is a logged debug event.", "scope")
```

## Features

The package provides a global scope object `Log` that can be used to store, examine and export messages and events.

Events must be classified at one of the accepted priority levels (`DEBUG`, `INFO`, `WARN`, and `ERROR`).
A special level `DISABLE` is not meant for event classification; it can be used as a threshold to prevent any log
messages from being printed to the JavaScript console.

Suggested classification scheme:
- `DEBUG`: Lowest level events meant to track the normal operation of the application.
- `INFO`: Used to notify that an important operation has completed, for example a module or resource finishes loading.
- `WARN`: Used when an expected issue prevents the application from fully performing, but not altogether stopping, an operation.
- `ERROR`: Used when an (usually) unexpected issue prevents the application from continuing an operation.

Each of these levels have their own shorthand, namely `Log.debug()`, `Log.info()`, `Log.warn()`, and `Log.error()`. The three former accept as arguments a `message` and `scope` (both strings). The error shorthand also accepts a third argument for the actual `Error` that was thrown.

Every method takes a final optional `context` argument of type `LogEventContext`. It carries `announce` (ask the host application to show the message to the user, either verbatim or as a replacement string), `sensitive` (redact the message wherever the event is read back) and `extra` (anything else related to the event). `Log.error()` attaches the error and its stack frames under `extra`, keeping whatever the caller passed under `extra.caller`.

### Handling events from web workers

Since the worker operates in a different scope than the main document, the `Log` objects imported in workers are separate objects. Since we don't want to maintain multiple instances of the object, all with their individual event buffers, we can register a `worker` to automatically relay all events from its `Log` to the `Log` where it's registered (i.e. the main document).

A relayed event keeps its context, so an event a worker marked `sensitive` stays redacted on the main thread and an error logged in a worker arrives with its stack. Events below the worker forward threshold are dropped in the worker rather than serialised across threads; `Log.setWorkerForwardThreshold()` sets it, independently of the print threshold.

```javascript
import { Log } from 'scoped-event-log'
const worker = new Worker()
Log.registerWorker(worker)
// Now all Log messages from worker are relayed to local Log.
```