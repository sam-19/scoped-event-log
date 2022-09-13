/**
 * Scoped TypeScript log tests.
 * @package    scoped-ts-log
 * @copyright  2022 Sampsa Lohi
 * @license    MIT
 */

import {describe, expect, test} from '@jest/globals'
import Log from '../src'

// Avoid messages in the console during test
console['debug'] = () => {}
console['error'] = () => {}
console['info'] = () => {}
console['warn'] = () => {}
/** Console warn listener mock. */
const debug = jest.spyOn(console, 'debug')
const error = jest.spyOn(console, 'error')
const info = jest.spyOn(console, 'info')
const warn = jest.spyOn(console, 'warn')

describe('Log setup', () => {
    test('Log exists in global scope', () => {
        expect(Log).toBeDefined()
    })
    test('Default print threshold is INFO (1)', () => {
        expect(Log.getPrintThreshold()).toStrictEqual(1)
    })
    test('Setting default print threshold', () => {
        Log.setPrintThreshold('DEBUG')
        expect(Log.getPrintThreshold()).toStrictEqual(0)
    })
    test('Setting and incorrect print threshold', () => {
        // @ts-ignore
        Log.setPrintThreshold('FOOBAR')
        expect(warn).toHaveBeenCalledTimes(1)
        warn.mockReset()
        expect(Log.getPrintThreshold()).toStrictEqual(0)
    })
})

describe('Logging events', () => {
    test('Log events with add call', () => {
        Log.add('DEBUG', 'Test add DEBUG', 'Test add')
        expect(debug).toHaveBeenCalledTimes(1)
        expect(Log.getScopeEvents('Test add').length).toStrictEqual(1)
        Log.add('INFO', 'Test add INFO', 'Test add')
        expect(info).toHaveBeenCalledTimes(1)
        expect(Log.getScopeEvents('Test add').length).toStrictEqual(2)
        Log.add('WARN', 'Test add WARN', 'Test add')
        expect(warn).toHaveBeenCalledTimes(1)
        expect(Log.getScopeEvents('Test add').length).toStrictEqual(3)
        Log.add('ERROR', 'Test add ERROR', 'Test add')
        expect(error).toHaveBeenCalledTimes(1)
        expect(Log.getScopeEvents('Test add').length).toStrictEqual(4)
        Log.add('DISABLE', 'Test add DISABLE', 'Test add')
        expect(warn).toHaveBeenCalledTimes(2)
        expect(Log.getScopeEvents('Test add').length).toStrictEqual(4)
    })
    test('Log events with shorthand calls', () => {
        debug.mockReset()
        info.mockReset()
        warn.mockReset()
        error.mockReset()
        Log.setPrintThreshold('WARN')
        Log.debug('Test debug', 'Test shorthand')
        expect(debug).not.toHaveBeenCalled()
        expect(Log.getScopeEvents('Test shorthand').length).toStrictEqual(1)
        Log.info('Test info', 'Test shorthand')
        expect(info).not.toHaveBeenCalled()
        expect(Log.getScopeEvents('Test shorthand').length).toStrictEqual(2)
        Log.warn('Test warn', 'Test shorthand')
        expect(warn).toHaveBeenCalledTimes(1)
        expect(Log.getScopeEvents('Test shorthand').length).toStrictEqual(3)
        Log.error('Test error', 'Test shorthand')
        expect(error).toHaveBeenCalledTimes(1)
        expect(Log.getScopeEvents('Test shorthand').length).toStrictEqual(4)
    })
    test ('Retrieve events', () => {
        const allEvents = Log.getAllEvents()
        expect(allEvents.length).toStrictEqual(8)
        const scopeEvents = Log.getScopeEvents('Test shorthand')
        expect(scopeEvents[0].message).toStrictEqual('Test debug')
        expect(scopeEvents[1].level).toStrictEqual(Log.LEVELS['INFO'])
        expect(scopeEvents[2].message).toStrictEqual('Test warn')
        expect(scopeEvents[3].level).toStrictEqual(Log.LEVELS['ERROR'])
    })
    test('Remove events', () => {
        Log.removeEventsAtLevel('ERROR')
        expect(Log.getScopeEvents('Test add').length).toStrictEqual(3)
        expect(Log.getScopeEvents('Test shorthand').length).toStrictEqual(3)
        Log.removeScopeEventsAtLevel('Test add', 'WARN')
        expect(Log.getScopeEvents('Test add').length).toStrictEqual(2)
        expect(Log.getScopeEvents('Test shorthand').length).toStrictEqual(3)
        Log.removeEventsBelowLevel('INFO')
        expect(Log.getScopeEvents('Test add').length).toStrictEqual(1)
        expect(Log.getScopeEvents('Test shorthand').length).toStrictEqual(2)
        Log.removeScopeEvents('Test shorthand')
        expect(Log.getScopeEvents('Test add').length).toStrictEqual(1)
        expect(Log.getScopeEvents('Test shorthand').length).toStrictEqual(0)
        Log.clear()
        expect(Log.getScopeEvents('Test add').length).toStrictEqual(0)
    })
})
