/**
 * Scoped event log tests.
 * @package    scoped-event-log
 * @copyright  2022 Sampsa Lohi
 * @license    MIT
 */

import {describe, expect, test} from '@jest/globals'
import { Log } from '../src/Log'

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
        expect(Log.getPrintThreshold()).toStrictEqual("INFO")
    })
    test('Setting default print threshold', () => {
        Log.setPrintThreshold('DEBUG')
        expect(Log.getPrintThreshold()).toStrictEqual("DEBUG")
    })
    test('Setting and incorrect print threshold', () => {
        // @ts-ignore
        Log.setPrintThreshold('FOOBAR')
        expect(warn).toHaveBeenCalledTimes(1)
        warn.mockReset()
        expect(Log.getPrintThreshold()).toStrictEqual("DEBUG")
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
    test('Log events with shorthand method calls', () => {
        debug.mockReset()
        info.mockReset()
        warn.mockReset()
        error.mockReset()
        Log.setPrintThreshold('WARN')
        Log.debug('Test debug()', 'Test shorthand methods')
        expect(debug).not.toHaveBeenCalled()
        expect(Log.getScopeEvents('Test shorthand methods').length).toStrictEqual(1)
        Log.info('Test info()', 'Test shorthand methods')
        expect(info).not.toHaveBeenCalled()
        expect(Log.getScopeEvents('Test shorthand methods').length).toStrictEqual(2)
        Log.warn('Test warn()', 'Test shorthand methods')
        expect(warn).toHaveBeenCalledTimes(1)
        expect(Log.getScopeEvents('Test shorthand methods').length).toStrictEqual(3)
        Log.error('Test error()', 'Test shorthand methods')
        expect(error).toHaveBeenCalledTimes(1)
        expect(Log.getScopeEvents('Test shorthand methods').length).toStrictEqual(4)
    })
    test ('Retrieve events', () => {
        const allEvents = Log.getAllEvents()
        expect(allEvents.length).toStrictEqual(8)
        const warnEvents = Log.getAllEventsAtLevel("WARN")
        expect(warnEvents.length).toStrictEqual(2)
        expect(warnEvents.every(e => e.level === Log.LEVELS['WARN']))
        const warnOrAbove = Log.getAllEventsAtOrAboveLevel("WARN")
        expect(warnOrAbove.length).toStrictEqual(4)
        expect(warnOrAbove.every(e => e.level >= Log.LEVELS['WARN']))
        const warnOrBelow = Log.getAllEventsAtOrBelowLevel("WARN")
        expect(warnOrBelow.length).toStrictEqual(6)
        expect(warnOrAbove.every(e => e.level <= Log.LEVELS['WARN']))
        const scopeEvents = Log.getScopeEvents('Test shorthand methods')
        expect(scopeEvents[0].message).toStrictEqual('Test debug()')
        expect(scopeEvents[1].level).toStrictEqual(Log.LEVELS['INFO'])
        expect(scopeEvents[2].message).toStrictEqual('Test warn()')
        expect(scopeEvents[3].level).toStrictEqual(Log.LEVELS['ERROR'])
    })
    test('Remove events', () => {
        Log.removeEventsAtLevel('ERROR')
        expect(Log.getScopeEvents('Test add').length).toStrictEqual(3)
        expect(Log.getScopeEvents('Test shorthand methods').length).toStrictEqual(3)
        Log.removeScopeEventsAtLevel('Test add', 'WARN')
        expect(Log.getScopeEvents('Test add').length).toStrictEqual(2)
        expect(Log.getScopeEvents('Test shorthand methods').length).toStrictEqual(3)
        Log.removeEventsBelowLevel('INFO')
        expect(Log.getScopeEvents('Test add').length).toStrictEqual(1)
        expect(Log.getScopeEvents('Test shorthand methods').length).toStrictEqual(2)
        Log.removeScopeEvents('Test shorthand methods')
        expect(Log.getScopeEvents('Test add').length).toStrictEqual(1)
        expect(Log.getScopeEvents('Test shorthand methods').length).toStrictEqual(0)
        Log.clear()
        expect(Log.getScopeEvents('Test add').length).toStrictEqual(0)
    })
    test('Sensitive events', () => {
        Log.debug("Test debug sensitive", "Test sensitive", true)
        Log.info("Test info sensitive", "Test sensitive", true)
        Log.warn("Test warn sensitive", "Test sensitive", true)
        Log.error("Test error sensitive", "Test sensitive", undefined, true)
        const scopeEvents = Log.getScopeEvents('Test sensitive')
        expect(scopeEvents[0].message).toStrictEqual('### SENSITIVE INFO REDACTED ###')
        expect(scopeEvents[1].message).toStrictEqual('### SENSITIVE INFO REDACTED ###')
        expect(scopeEvents[2].message).toStrictEqual('### SENSITIVE INFO REDACTED ###')
        expect(scopeEvents[3].message).toStrictEqual('### SENSITIVE INFO REDACTED ###')
        expect(scopeEvents[0].level).toStrictEqual(Log.LEVELS['DEBUG'])
        expect(scopeEvents[1].level).toStrictEqual(Log.LEVELS['INFO'])
        expect(scopeEvents[2].level).toStrictEqual(Log.LEVELS['WARN'])
        expect(scopeEvents[3].level).toStrictEqual(Log.LEVELS['ERROR'])
    })
})
describe("Event listeners", () => {
    let eventCount = 0
    const listener = () => {
        eventCount++
    }
    test('Add single event listener', () => {
        Log.addEventListener("DEBUG", listener, "test")
        Log.debug("Test debug listener.", "Test listeners")
        expect(eventCount).toStrictEqual(1)
    })
    test('Remove event listener', () => {
        const rmCount = Log.removeEventListeners("DEBUG", listener)
        expect(rmCount).toStrictEqual(1)
        Log.debug("Test removed debug listener.", "Test listeners")
        expect(eventCount).toStrictEqual(1)
    })
    test('Multiple events listener', () => {
        eventCount = 0
        Log.addEventListener(["DEBUG", "INFO", "WARN"], listener, "test")
        Log.debug("Test multiple listener.", "Test listeners")
        expect(eventCount).toStrictEqual(1)
        const rmCount = Log.removeEventListeners(["DEBUG", "INFO"], listener)
        expect(rmCount).toStrictEqual(2)
        Log.debug("Test removed multiple listener.", "Test listeners")
        expect(eventCount).toStrictEqual(1)
        Log.warn("Test remaining multiple listener.", "Test listeners")
        expect(eventCount).toStrictEqual(2)
    })
    test('Remove all listeners', () => {
        eventCount = 0
        const antiListener = () => {
            eventCount--
        }
        Log.addEventListener(["DEBUG", "WARN"], antiListener, "remove")
        const rmAllForCount = Log.removeAllEventListeners("test")
        expect(rmAllForCount).toStrictEqual(1)
        Log.warn("Test remove all.", "Test removal")
        expect(eventCount).toStrictEqual(-1)
        const rmAllCount = Log.removeAllEventListeners()
        expect(rmAllCount).toStrictEqual(2)
        Log.warn("Test remove all again.", "Test removal")
        expect(eventCount).toStrictEqual(-1)
    })
})
describe("JSON export", () => {
    test('Export events to JSON', () => {
        Log.clear()
        Log.debug("Export debug", "Test export")
        Log.info("Export info", "Test export", true)
        Log.warn("Export warn", "Test export")
        Log.error("Export error", "Test export")
        const jsonInfo = Log.exportToJson("INFO")
        const jsInfo = JSON.parse(jsonInfo)
        expect(Array.isArray(jsInfo)).toStrictEqual(true)
        expect(jsInfo.length).toStrictEqual(1)
        expect(jsInfo[0].level).toStrictEqual(1)
        const jsonAll = Log.exportToJson()
        const jsAll = JSON.parse(jsonAll)
        expect(jsAll.length).toStrictEqual(4)
        for (let i=0; i<jsAll.length; i++) {
            expect(jsAll[i].level).toStrictEqual(i)
            if (i === 1) {
                expect(jsAll[i].message).toStrictEqual('### SENSITIVE INFO REDACTED ###')
            } else {
                expect(jsAll[i].message.substring(0, 6)).toStrictEqual('Export')
            }
        }
    })
})
describe("Event limit", () => {
    test("Remove older events if limit is reached", () => {
        Log.clear()
        Log.maxEvents = 5
        Log.debug("Test debug", "Test limit")
        Log.info("Test info", "Test limit")
        Log.warn("Test warn", "Test limit")
        Log.error("Test error", "Test limit")
        Log.debug("Test 1", "Test limit")
        Log.debug("Test 2", "Test exceed")
        Log.debug("Test 3", "Test exceed")
        expect(Log.getAllEvents().length).toStrictEqual(5)
        expect(Log.getScopeEvents("Test limit").length).toStrictEqual(3)
        expect(Log.getScopeEvents("Test exceed").length).toStrictEqual(2)
    })
})
