/**
 * Log inspector element tests.
 *
 * @vitest-environment jsdom
 *
 * @package    scoped-event-log
 * @copyright  2026 Sampsa Lohi
 * @license    MIT
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Log } from '../src/Log'
import { LogInspector } from '../src/LogInspector'

/**
 * Report `dark` as the colour scheme the host prefers. The element reads this on connection, and the
 * dark branch is the one that applies a class, so a test that leaves the scheme at the jsdom default
 * exercises the branch that writes nothing.
 */
const prefersDark = (dark: boolean) => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>()
    const query = {
        matches: dark,
        media: '(prefers-color-scheme: dark)',
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
            listeners.add(listener)
        },
        removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
            listeners.delete(listener)
        },
    }
    window.matchMedia = vi.fn(() => query) as unknown as typeof window.matchMedia
    return { listeners, query }
}

const realMatchMedia = window.matchMedia

afterEach(() => {
    document.body.replaceChildren()
    window.matchMedia = realMatchMedia
})

describe('Element construction', () => {
    beforeEach(() => {
        prefersDark(true)
    })
    /**
     * The custom element spec forbids a constructor from writing attributes or adding children, and
     * `document.createElement` answers a violation with a NotSupportedError. Only the dark branch of
     * the colour-scheme application writes anything, and what it writes is a class, so a scheme
     * resolved before connection makes the host's own preference decide whether the element can be
     * constructed at all.
     */
    test('a constructed element carries no attributes even when the host prefers dark', () => {
        const inspector = new LogInspector()
        expect(inspector.attributes.length).toStrictEqual(0)
        expect(inspector.classList.length).toStrictEqual(0)
    })
    test('createElement answers with an element rather than an error', () => {
        const inspector = document.createElement('log-inspector')
        expect(inspector).toBeInstanceOf(LogInspector)
        expect(inspector.attributes.length).toStrictEqual(0)
    })
})

describe('Colour scheme', () => {
    test('the dark class is applied once the element is connected', () => {
        prefersDark(true)
        const inspector = new LogInspector()
        expect(inspector.classList.contains('wa-dark')).toStrictEqual(false)
        document.body.appendChild(inspector)
        expect(inspector.classList.contains('wa-dark')).toStrictEqual(true)
    })
    test('a light host leaves the element unclassed', () => {
        prefersDark(false)
        const inspector = new LogInspector()
        document.body.appendChild(inspector)
        expect(inspector.classList.contains('wa-dark')).toStrictEqual(false)
    })
    test('an explicit mode is honoured over the host preference', () => {
        prefersDark(true)
        const inspector = new LogInspector()
        inspector.mode = 'light'
        document.body.appendChild(inspector)
        expect(inspector.classList.contains('wa-dark')).toStrictEqual(false)
    })
    test('a change of the host preference is followed while the mode is system', () => {
        const { listeners } = prefersDark(false)
        const inspector = new LogInspector()
        document.body.appendChild(inspector)
        expect(inspector.classList.contains('wa-dark')).toStrictEqual(false)
        for (const listener of listeners) {
            listener({ matches: true } as MediaQueryListEvent)
        }
        expect(inspector.classList.contains('wa-dark')).toStrictEqual(true)
    })
})

describe('Subscriptions', () => {
    test('the colour-scheme subscription is released when the element is disconnected', () => {
        const { listeners } = prefersDark(true)
        const inspector = new LogInspector()
        document.body.appendChild(inspector)
        expect(listeners.size).toStrictEqual(1)
        inspector.remove()
        expect(listeners.size).toStrictEqual(0)
    })
    test('the log subscription is released with the same levels it was taken out on', () => {
        prefersDark(true)
        const added = vi.spyOn(Log, 'addEventListener')
        const removed = vi.spyOn(Log, 'removeEventListeners')
        const inspector = new LogInspector()
        document.body.appendChild(inspector)
        expect(added).toBeCalledTimes(1)
        inspector.remove()
        expect(removed).toBeCalledTimes(1)
        // A level list or a listener that does not match the subscription leaves it in place, so the
        // two calls have to agree on both.
        expect(removed.mock.calls[0][0]).toStrictEqual(added.mock.calls[0][0])
        expect(removed.mock.calls[0][1]).toBe(added.mock.calls[0][1])
        added.mockRestore()
        removed.mockRestore()
    })
    test('a reconnected element follows the host preference again', () => {
        const { listeners } = prefersDark(false)
        const inspector = new LogInspector()
        document.body.appendChild(inspector)
        inspector.remove()
        document.body.appendChild(inspector)
        for (const listener of listeners) {
            listener({ matches: true } as MediaQueryListEvent)
        }
        expect(inspector.classList.contains('wa-dark')).toStrictEqual(true)
    })
})

describe('Mode changes after connection', () => {
    test('setting the mode re-applies the theme', async () => {
        prefersDark(true)
        const inspector = new LogInspector()
        document.body.appendChild(inspector)
        expect(inspector.classList.contains('wa-dark')).toStrictEqual(true)
        inspector.mode = 'light'
        await inspector.updateComplete
        expect(inspector.classList.contains('wa-dark')).toStrictEqual(false)
    })
})
