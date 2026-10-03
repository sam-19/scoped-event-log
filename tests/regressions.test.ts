/**
 * Scoped event log regression tests.
 *
 * Each case pins a defect the rest of the suite could not see: the worker relay read a key the
 * worker never posts, the timestamp rendered the wrong one of its two branches, a captured error
 * replaced the caller's own attachment, a worker dropped an unusable level without saying so, and
 * the printed flag was never set.
 * @package    scoped-event-log
 * @copyright  2026 Sampsa Lohi
 * @license    MIT
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Log } from '../src/Log'

/** A worker stand-in that hands back the handler `registerWorker` attaches. */
const fakeWorker = () => {
    const handlers: ((message: MessageEvent) => void)[] = []
    const worker = {
        addEventListener: (_type: string, handler: (message: MessageEvent) => void) => {
            handlers.push(handler)
        },
        removeEventListener: () => undefined,
        postMessage: vi.fn(),
    }
    return {
        worker: worker as unknown as Worker,
        /** Deliver a message as the worker would. */
        post: (data: unknown) => handlers.forEach(h => h({ data } as MessageEvent)),
    }
}

const lastEvent = () => Log.getAllEvents()[Log.getAllEvents().length - 1]

beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    Log.clear()
    Log.setPrintThreshold('DEBUG')
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('A relayed worker event keeps its context', () => {
    test('The sensitive flag survives the relay, so the message stays redacted', () => {
        // Dropping the context loses the one field that makes `message` redact itself, so a message
        // the worker withheld from its own console was printed in full on this side.
        const { worker, post } = fakeWorker()
        Log.registerWorker(worker)
        post({
            action: 'log',
            level: 'ERROR',
            message: 'patient identifier 12345',
            scope: 'Worker',
            context: { sensitive: true },
        })
        expect(lastEvent().sensitive).toBe(true)
        expect(lastEvent().message).not.toContain('12345')
    })
    test('The announce flag survives the relay', () => {
        const { worker, post } = fakeWorker()
        Log.registerWorker(worker)
        post({
            action: 'log',
            level: 'WARN',
            message: 'cache full',
            scope: 'Worker',
            context: { announce: 'Could not cache the recording.' },
        })
        expect(lastEvent().announce).toStrictEqual('Could not cache the recording.')
    })
    test('The error and stack a worker captured survive the relay', () => {
        const { worker, post } = fakeWorker()
        Log.registerWorker(worker)
        post({
            action: 'log',
            level: 'ERROR',
            message: 'failed',
            scope: 'Worker',
            context: { extra: { error: 'DataCloneError', stack: ['at one', 'at two'] } },
        })
        expect(lastEvent().extra).toEqual({ error: 'DataCloneError', stack: ['at one', 'at two'] })
    })
    test('The key the worker posts is the key the relay reads', () => {
        // The two halves live in the same class but neither names the other, so nothing but this
        // case fails when one of them is renamed.
        const posted = vi.fn()
        class FakeWorkerGlobalScope {}
        vi.stubGlobal('WorkerGlobalScope', FakeWorkerGlobalScope)
        vi.stubGlobal('self', new FakeWorkerGlobalScope())
        vi.stubGlobal('postMessage', posted)
        Log.warn('from the worker', 'Worker', { sensitive: true })
        expect(posted).toHaveBeenCalledTimes(1)
        const message = posted.mock.calls[0][0] as { context?: unknown }
        expect(message.context).toEqual({ sensitive: true })
    })
})

describe('A timestamp renders the zone it was asked for', () => {
    test('The default rendering is local time and the flag asks for UTC', () => {
        // Built from the event's own date, so the contract holds in every zone. The two renderings
        // differ, and the case therefore discriminates, wherever the offset is not zero.
        Log.add('INFO', 'timed', 'Test')
        const time = lastEvent().time
        const date = time.date
        const pad = (n: number) => n.toString().padStart(2, '0')
        const local = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
                      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
        const utc = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-` +
                    `${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:` +
                    `${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
        expect(time.toString()).toStrictEqual(local)
        expect(time.toString(true)).toStrictEqual(utc)
        if (date.getTimezoneOffset() !== 0) {
            expect(time.toString()).not.toStrictEqual(time.toString(true))
        }
    })
})

describe('Log.error adds the captured error to the context', () => {
    test('Whatever the caller attached is kept', () => {
        Log.error('failed', 'Test', undefined, { extra: { requestId: 7 } })
        const extra = lastEvent().extra as { caller?: unknown }
        expect(extra.caller).toEqual({ requestId: 7 })
    })
    test('The captured error and stack are present', () => {
        Log.error('failed', 'Test', new Error('boom'))
        const extra = lastEvent().extra as { error?: Error, stack?: string[] }
        expect(extra.error?.message).toStrictEqual('boom')
        expect(Array.isArray(extra.stack)).toBe(true)
    })
    test('The context object the caller passed is left alone', () => {
        // The argument is an object the caller still holds and may reuse for a second call.
        const context = { extra: { requestId: 7 } }
        Log.error('failed', 'Test', undefined, context)
        expect(context.extra).toEqual({ requestId: 7 })
    })
})

describe('An event payload renders as readable lines', () => {
    test('The error shape becomes the error and its frames', () => {
        // `Log.error` always builds this shape, so a surface that prints the payload directly shows
        // `[object Object]` for every error the application logs.
        const lines = Log.formatExtra({ error: new Error('boom'), stack: ['at one', 'at two'] })
        expect(lines[0]).toContain('boom')
        expect(lines).toContain('at one')
        expect(lines).toContain('at two')
    })
    test('What the caller attached is rendered after the error', () => {
        // Keeping the caller's payload is only half the fix: a payload no surface prints is as
        // invisible as one that was discarded.
        const lines = Log.formatExtra({
            error: new Error('boom'),
            stack: ['at one'],
            caller: { requestId: 7 },
        })
        expect(lines).toContain('{"requestId":7}')
        expect(lines.indexOf('{"requestId":7}')).toBeGreaterThan(lines.indexOf('at one'))
    })
    test('An error logged with a caller payload prints both', () => {
        Log.error('failed', 'Test', new Error('boom'), { extra: ['context line'] })
        expect(Log.formatExtra(lastEvent().extra)).toContain('context line')
    })
    test('An array payload keeps one line per entry', () => {
        expect(Log.formatExtra(['first', 'second'])).toEqual(['first', 'second'])
    })
    test('An unrecognised object is dumped rather than named by its class', () => {
        expect(Log.formatExtra({ requestId: 7 })).toEqual(['{"requestId":7}'])
    })
    test('A payload that points back at itself is dumped rather than followed', () => {
        // The payload comes from the caller, and the logger is the last place that should fail.
        const circular: { caller?: unknown } = {}
        circular.caller = circular
        const lines = Log.formatExtra({ error: new Error('boom'), caller: circular })
        expect(lines.length).toBeLessThan(20)
        expect(lines[0]).toContain('boom')
    })
    test('An absent payload renders nothing', () => {
        expect(Log.formatExtra(undefined)).toEqual([])
    })
})

describe('A worker names an unusable level rather than dropping it', () => {
    beforeEach(() => {
        class FakeWorkerGlobalScope {}
        vi.stubGlobal('WorkerGlobalScope', FakeWorkerGlobalScope)
        vi.stubGlobal('self', new FakeWorkerGlobalScope())
        vi.stubGlobal('postMessage', vi.fn())
    })
    test('An invalid level is reported, as it is on the main thread', () => {
        Log.add('FOOBAR' as 'DEBUG', 'message', 'Worker')
        expect(console.warn).toHaveBeenCalledTimes(1)
    })
    test('A level below the forward threshold is dropped without a warning', () => {
        Log.add('DEBUG', 'message', 'Worker')
        expect(console.warn).not.toHaveBeenCalled()
    })
})

describe('An event records that it has been printed', () => {
    test('The flag is set once the message reaches the console', () => {
        Log.add('ERROR', 'printed once', 'Test')
        expect(lastEvent().printed).toBe(true)
    })
    test('An event below the print threshold is not marked', () => {
        Log.setPrintThreshold('ERROR')
        Log.add('DEBUG', 'never printed', 'Test')
        expect(lastEvent().printed).toBe(false)
    })
})
