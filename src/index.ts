/**
 * Scoped TypeScript log.
 * @package    scoped-ts-log
 * @copyright  2022 Sampsa Lohi
 * @license    MIT
 */

class Log {
    // Static properties
    /** Log event priority levels (in ascending order). */
    static readonly LEVELS = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        DISABLE: 4,
    }
    /** List of logged events. */
    protected static events: LogEvent[] = []
    protected static _prevTimestamp: number | null = null
    /** Time stamp of the previous logged event. */
    static get prevTimestamp () {
        return Log._prevTimestamp
    }
    /** Events at and above this level will be printed to console. */
    protected static printThreshold: number = 1

    /**
     * Add a new event to the log at the given level.
     * @param level - Event priority as key of Log.LEVELS.
     * @param message - Message as a string or array of strings (where each item is its own line).
     * @param scope - Scope of the event.
     */
    static add (level: keyof typeof Log.LEVELS, message: string | string[], scope: string, extra?: any) {
        if (Object.keys(Log.LEVELS).indexOf(level) === -1 || level === 'DISABLE') {
            // Not a valid logging level
            console.warn(`Rejected an event with an invalid log level: (${level}) ${message}`)
        } else {
            const logEvent = new LogEvent(Log.LEVELS[level], message, scope, extra)
            if (Log.LEVELS[level] >= Log.printThreshold) {
                this.print(logEvent)
            }
            Log.events.push(logEvent)
            Log._prevTimestamp = logEvent.time.toTime()
        }
    }

    /**
     * Remove all events from the log.
     */
    static clear () {
        Log.events.splice(0)
    }

    /**
     * Add a message at debug level to the log.
     * @param message - Message as a string or array of strings (where each item is its own line).
     * @param scope - Scope of the event.
     */
    static debug (message: string | string[], scope: string) {
        Log.add("DEBUG", message, scope)
    }

    /**
     * Add a message at error level to the log.
     * @param message - Message as a string or array of strings (where each item is its own line).
     * @param scope - Scope of the event.
     * @param error - Optional Error object.
     */
    static error (message: string | string[], scope: string, error?: Error) {
        // TODO: This sometimes gives unexpected results when the origin of the error is traced
        //       back to this line. Alternative ways to find the call stack without throwing
        //       an error?
        error = error || new Error(Array.isArray(message) ? message.join() : message)
        let stack = (error.stack || '').split(/\r?\n/g)
        stack = stack.length > 1 ? stack.slice(1) : stack
        Log.add("ERROR", message, scope, stack)
    }

    /**
     * Get all logged events.
     * @returns All logged events as an array of LogEvents.
     */
    static getAllEvents () {
        return Log.events
    }

    /**
     * Get current event printing threshold.
     */
    static getPrintThreshold (): keyof typeof Log.LEVELS {
        for (const [key, value] of Object.entries(Log.LEVELS)) {
            if (value === Log.printThreshold) {
                return key as keyof typeof Log.LEVELS
            }
        }
        return "DISABLE"
    }

    /**
     * Get all the events added to the given `scope`.
     * @param scope - Scope to check.
     * @returns array of matching LogEvents.
     */
    static getScopeEvents (scope: string) {
        const events = [] as LogEvent[]
        for (const event of Log.events) {
            if (event.scope === scope) {
                events.push(event)
            }
        }
        return events
    }

    /**
     * Add a message at info level to the log.
     * @param message - Message as a string or array of strings (where each item is its own line).
     * @param scope - Optional scope of the event.
     */
    static info (message: string | string[], scope: string) {
        Log.add("INFO", message, scope)
    }

    /**
     * Print a log event's message to console.
     * @param logEvent - The event to print.
     */
    static print (logEvent: LogEvent) {
        let message = []
        if (logEvent.scope) {
            message.push(`[${logEvent.scope}]`)
        }
        message.push(
            logEvent.time.toString(),
            typeof logEvent.message === 'string'
                ? logEvent.message
                : + Array.isArray(logEvent.message)
                    ? logEvent.message.join('\n')
                    : logEvent.message.toString()
        )
        if (logEvent.level === Log.LEVELS.DEBUG) {
            message.unshift('DEBUG')
            if (logEvent.extra) {
                console.debug(
                    message.join(' ')
                    + '\n'
                    + Array.isArray(logEvent.extra)
                        ? logEvent.extra.join('\n')
                        : logEvent.extra.toString()
                )
            } else {
                console.debug(message.join(' '))
            }
        } else if (logEvent.level === Log.LEVELS.INFO) {
            // Keep the first part of the message always the same length
            message.unshift('INFO ')
            if (logEvent.extra) {
                console.info(
                    message.join(' ')
                    + '\n'
                    + Array.isArray(logEvent.extra)
                        ? logEvent.extra.join('\n')
                        : logEvent.extra.toString()
                )
            } else {
                console.info(message.join(' '))
            }
        } else if (logEvent.level === Log.LEVELS.WARN) {
            message.unshift('WARN ')
            if (logEvent.extra) {
                console.warn(
                    message.join(' ')
                    + '\n'
                    + Array.isArray(logEvent.extra)
                        ? logEvent.extra.join('\n')
                        : logEvent.extra.toString()
                )
            } else {
                console.warn(message.join(' '))
            }
        } else if (logEvent.level === Log.LEVELS.ERROR) {
            message.unshift('ERROR')
            if (logEvent.extra) {
            console.error(
                message.join(' ')
                + '\n'
                + Array.isArray(logEvent.extra)
                    ? logEvent.extra.join('\n')
                    : logEvent.extra.toString()
            )
            } else {
                console.error(message.join(' '))
            }
        }
    }

    /**
     * Remove all events _at_ the given priority `level` from the log.
     * @param level - Level at which events will be removed.
     */
    static removeEventsAtLevel (level: keyof typeof Log.LEVELS) {
        if (Object.keys(Log.LEVELS).indexOf(level) === -1 || level === 'DISABLE') {
            // Not a valid logging level
            console.warn(`Cannot remove events at an invalid log level (${level}).`)
            return
        }
        for (let i=0; i<Log.events.length; i++) {
            if (Log.events[i].level === Log.LEVELS[level]) {
                Log.events.splice(i, 1)
                i--
            }
        }
    }

    /**
     * Remove all events _below_ the given priority `level` from the log.
     * @param level - Level below which events will be removed (events at the level will remain).
     */
    static removeEventsBelowLevel (level: keyof typeof Log.LEVELS) {
        if (Object.keys(Log.LEVELS).indexOf(level) === -1 || level === 'DISABLE') {
            // Not a valid logging level
            console.warn(`Cannot remove events below an invalid log level (${level}).`)
            return
        }
        for (let i=0; i<Log.events.length; i++) {
            if (Log.events[i].level < Log.LEVELS[level]) {
                Log.events.splice(i, 1)
                i--
            }
        }
    }

    /**
     * Remove all events of a given `scope` from the log.
     * @param scope - The scope of the events.
     */
    static removeScopeEvents (scope: string) {
        for (let i=0; i<Log.events.length; i++) {
            if (Log.events[i].scope === scope) {
                Log.events.splice(i, 1)
                i--
            }
        }
    }

    /**
     * Remove events _at_ the given priority `level` in the given `scope` from the log.
     * @param scope - Scope of the events.
     * @param level - Level at which events will be removed.
     */
    static removeScopeEventsAtLevel (scope: string, level: keyof typeof Log.LEVELS) {
        if (Object.keys(Log.LEVELS).indexOf(level) === -1 || level === 'DISABLE') {
            // Not a valid logging level
            console.warn(`Cannot remove scope ${scope} events below an invalid log level (${level}).`)
            return
        }
        for (let i=0; i<Log.events.length; i++) {
            if (Log.events[i].scope === scope && Log.events[i].level === Log.LEVELS[level]) {
                Log.events.splice(i, 1)
                i--
            }
        }
    }

    /**
     * Remove all events _below_ the given priority `level` in the given `scope` from the log.
     * @param scope - Scope of the events.
     * @param level - Level below which events will be removed (events at the level will remain).
     */
    static removeScopeEventsBelowLevel (scope: string, level: keyof typeof Log.LEVELS) {
        if (Object.keys(Log.LEVELS).indexOf(level) === -1 || level === 'DISABLE') {
            // Not a valid logging level
            console.warn(`Cannot remove scope ${scope} events below an invalid log level (${level}).`)
            return
        }
        for (let i=0; i<Log.events.length; i++) {
            if (Log.events[i].scope === scope && Log.events[i].level < Log.LEVELS[level]) {
                Log.events.splice(i, 1)
                i--
            }
        }
    }

    /**
     * Set a new printing threshold level.
     * @param level - Print messages at or above this level to console.
     */
    static setPrintThreshold (level: keyof typeof Log.LEVELS) {
        if (Object.keys(Log.LEVELS).indexOf(level) !== -1) {
            Log.printThreshold = Log.LEVELS[level]
        } else {
            console.warn(`Did not set invalid printing threshold ${level}`)
        }
    }

    /**
     * Add a message at warning level to the log.
     * @param message - Message as a string or array of strings (where each item is its own line).
     * @param scope - Scope of the event.
     */
    static warn (message: string | string[], scope: string) {
        Log.add("WARN", message, scope)
    }
}

// Auxiliary classes that are not meant to be exported

/**
 * A single event in the log.
 */
class LogEvent {
    /** Any extra properties. */
    protected _extra: any
    /** Event priority level. */
    protected _level: number
    /** Message lines as a string or an array of strings. */
    protected _message: string | string[]
    /** Has this event's message already been printed to console. */
    protected _printed: boolean
    /** Scope of the event. */
    protected _scope: string
    /** Timestamp of logging the event. */
    protected _time: LogTimestamp

    constructor (level: number, message: string | string[], scope: string, extra?: any) {
        this._extra = extra
        this._level = level
        this._message = message
        this._printed = false
        this._scope = scope
        this._time = new LogTimestamp()
    }

    // Properties are immutable after initiation
    get extra () {
        return this._extra
    }
    get level () {
        return this._level
    }
    get message () {
        return this._message
    }
    get printed () {
        return this._printed
    }
    get scope () {
        return this._scope
    }
    get time () {
        return this._time
    }
}

/**
 * Log event timestamp.
 */
class LogTimestamp {
    protected _date: Date
    protected _delta: number | null

    constructor () {
        this._date = new Date()
        this._delta = Log.prevTimestamp ? this.date.getTime() - Log.prevTimestamp : null
    }

    // Properties are immutable after initiation
    get date () {
        return this._date
    }
    /** Time elapsed since the previous log event (in milliseconds). */
    get delta () {
        return this._delta
    }
    /**
     * Get a standard length datetime string from this timestamp
     * @param utc return as UTC time (default false)
     * @return YYYY-MM-DD hh:mm:ss
     */
    toString (utc=false) {
        let Y, M, D, h, m, s
        if (utc) {
            Y = this.date.getFullYear()
            M = (this.date.getMonth() + 1).toString().padStart(2, '0')
            D = this.date.getDate().toString().padStart(2, '0')
            h = this.date.getHours().toString().padStart(2, '0')
            m = this.date.getMinutes().toString().padStart(2, '0')
            s = this.date.getSeconds().toString().padStart(2, '0')
        } else {
            Y = this.date.getUTCFullYear()
            M = (this.date.getUTCMonth() + 1).toString().padStart(2, '0')
            D = this.date.getUTCDate().toString().padStart(2, '0')
            h = this.date.getUTCHours().toString().padStart(2, '0')
            m = this.date.getUTCMinutes().toString().padStart(2, '0')
            s = this.date.getUTCSeconds().toString().padStart(2, '0')
        }
        return `${Y}-${M}-${D} ${h}:${m}:${s}`
    }
    /**
     * Return timestamp as milliseconds.
     */
    toTime () {
        return this.date.getTime()
    }
}

export default Log
