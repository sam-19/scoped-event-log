/**
 * Scoped event log.
 * @package    scoped-event-log
 * @copyright  2024 Sampsa Lohi
 * @license    MIT
 */

/**
 * A log event listener method.
 * @param level - Logging level of the event.
 * @param event - The logging event itself.
 */
export type LogEventListener = (level?: LogLevel, event?: LogEvent) => unknown

/** Valid log message priority level. */
export type LogLevel = keyof typeof Log.LEVELS

/**
 * Log is a global scope object that can be used to store, examine and export messages and events.
 *
 * Events must be classified at one of the accepted priority levels (`DEBUG`, `INFO`, `WARN`, and `ERROR`).
 * A special level `DISABLE` is not meant for event classification; it can be used as a threshold to prevent any log
 * messages from being printed to the JavaScript console.
 *
 * Suggested classification scheme:
 * - `DEBUG`: Lowest level events meant to track the normal operation of the application.
 * - `INFO`: Used to notify that an important operation has completed, for example a module or resource finishes loading.
 * - `WARN`: Used when an expected issue prevents the application from fully performing, but not altogether stopping, an operation.
 * - `ERROR`: Used when an (usually) unexpected issue prevents the application from continuing an operation.
 *
 * Since the worker opertes in a different scope than the main document, the `Log` objects imported in workers are
 * separate objects. Since we don't want to maintain multiple instances of the object, all with their individual event
 * buffers, we can register a `worker` to automatically relay all events from its `Log` to the `Log` where it's
 * registered (i.e. the main document).
 * @example
 * ```
 * import { Log } from 'scoped-event-log'
 * const worker = new Worker()
 * Log.registerWorker(worker)
 * // Now all log messages from worker are relayed to Log
 * ```
 */
export class Log {
    // Static properties
    /** Log event priority levels (in ascending order). */
    static readonly LEVELS = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        DISABLE: 4,
    }
    /** List of log event listeners. */
    protected static eventListeners: {
        /** Event levels to listen to. */
        levels: LogLevel[]
        /** The listener method to call on matching events. */
        listener: LogEventListener
        /** Identifier for the owner of this listener. */
        owner: string | null
        /** Should this listener be called only a single time? */
        single: boolean
    }[] = []
    /** List of logged events. */
    protected static events: LogEvent[] = []
    protected static _prevTimestamp: number | null = null
    /** Time stamp of the previous logged event. */
    static get prevTimestamp () {
        return Log._prevTimestamp
    }
    /** Events at and above this level will be printed to console. */
    protected static printThreshold: number = 1
    protected static workers: Worker[] = []

    /**
     * Keep messages in worker scope separate from the main thread. If set to false, logged messages will
     * be relayed to the main thread for logging.
     */
    static separateWorkerScope = false

    /**
     * Add a new event to the log at the given level.
     * @param level - Event priority as key of Log.LEVELS.
     * @param message - Message as a string or array of strings (where each item is its own line).
     * @param scope - Scope of the event.
     */
    static add (level: keyof typeof Log.LEVELS, message: string | string[], scope: string, extra?: unknown) {
        // @ts-expect-error: Check if we are in worker scope.
        if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope &&
            typeof postMessage !== 'undefined' &&
            !Log.separateWorkerScope
        ) {
            postMessage({
                action: 'log',
                level: level,
                message: message,
                scope: scope,
                extra: extra,
            })
            // Message will be handled in the main document's Log.
            return
        }
        if (!Object.keys(Log.LEVELS).includes(level) || level === 'DISABLE') {
            // Not a valid logging level
            console.warn(`Rejected an event with an invalid log level: (${level}) ${message}`)
        } else {
            const logEvent = new LogEvent(Log.LEVELS[level], message, scope, extra)
            if (Log.LEVELS[level] >= Log.printThreshold) {
                this.print(logEvent)
            }
            Log.events.push(logEvent)
            Log._prevTimestamp = logEvent.time.toTime()
            Log.callEventListeners(level, logEvent)
        }
    }

    /**
     * Add a listener for events of each given logging `level`.
     * @param level - Log level or array of levels to listen to.
     * @param listener - Method to call when a listened event occurs.
     * @param owner - Optional identifier for the owner of the listener (for mass removal of registered listeners).
     * @param singleEvent - Only call once (on the next event) and then remove the listener (default false).
     */
    static addEventListener (
        level: LogLevel | LogLevel[],
        listener: LogEventListener,
        owner?: string,
        singleEvent = false
    ) {
        level = Array.isArray(level) ? level : [level] // Always store as an array.
        for (const ext of Log.eventListeners) {
            if (ext.listener === listener) {
                // Only add possible new levels.
                for (const lvl of level) {
                    if (!ext.levels.includes(lvl)) {
                        ext.levels.push(lvl)
                    }
                }
                return
            }
        }
        Log.eventListeners.push({
            owner: owner || null,
            levels: level,
            listener: listener,
            single: singleEvent,
        })
    }

    /**
     * Call all listeners for the given logging `level`.
     * @param level - Log level of the event.
     * @param event - The actual event.
     */
    protected static callEventListeners (level: LogLevel, event: LogEvent) {
        for (let i=0; i<Log.eventListeners.length; i++) {
            const evt = Log.eventListeners[i]
            if (evt.levels.includes(level)) {
                evt.listener(level, event)
                // Remove event listener if it was only meant to be called once.
                if (evt.single) {
                    Log.eventListeners.splice(i, 1)
                    i--
                }
            }
        }
    }

    /**
     * Remove all events from the log.
     */
    static clear () {
        Log.events.splice(0)
        // Send "clear" events to notify listeners that the log is empty.
        const debugEvent = new LogEvent(0, '__clear', 'Log')
        Log.callEventListeners("DEBUG", debugEvent)
        const infoEvent = new LogEvent(1, '__clear', 'Log')
        Log.callEventListeners("INFO", infoEvent)
        const warnEvent = new LogEvent(2, '__clear', 'Log')
        Log.callEventListeners("WARN", warnEvent)
        const errorEvent = new LogEvent(3, '__clear', 'Log')
        Log.callEventListeners("ERROR", errorEvent)
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
     * Export stored log events into JSON.
     * @param level - Optional priority level to filter the events by, will return all events if left empty.
     * @returns Event array as a JSON string.
     */
    static exportToJson (level?: LogLevel) {
        const events = level !== undefined ? Log.getAllEventsAtLevel(level) : Log.events
        const plainObjects = events.map(e => {
            return {
                level: e.level,
                message: e.message,
                scope: e.scope,
                time: e.time.date.getTime(),
            }
        })
        return JSON.stringify(plainObjects)
    }

    /**
     * Get all logged events.
     * @returns All logged events as an array of LogEvents.
     */
    static getAllEvents () {
        return Log.events
    }

    /**
     * Return all log events at the given level.
     * @param level - Level of events to return.
     * @returns LogEvent[]
     */
    static getAllEventsAtLevel (level: LogLevel) {
        const refLevel = Log.LEVELS[level]
        return Log.events.filter(e => e.level === refLevel)
    }

    /**
     * Return all log events at or above the given level.
     * @param level - Minimum level of events to return.
     * @returns LogEvent[]
     */
    static getAllEventsAtOrAboveLevel (level: LogLevel) {
        const refLevel = Log.LEVELS[level]
        return Log.events.filter(e => e.level >= refLevel)
    }

    /**
     * Return all log events at or below the given level.
     * @param level - Maximum level of events to return.
     * @returns LogEvent[]
     */
    static getAllEventsAtOrBelowLevel (level: LogLevel) {
        const refLevel = Log.LEVELS[level]
        return Log.events.filter(e => e.level <= refLevel)
    }

    /**
     * Get current event printing threshold.
     */
    static getPrintThreshold (): LogLevel {
        for (const [key, value] of Object.entries(Log.LEVELS) as [LogLevel, number][]) {
            if (value === Log.printThreshold) {
                return key
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
        const message = []
        if (logEvent.scope) {
            message.push(`[${logEvent.scope}]`)
        }
        message.push(
            logEvent.time.toString(),
            typeof logEvent.message === 'string'
                ? logEvent.message
                : logEvent.message.join
                    ? logEvent.message.join('\n')
                    : logEvent.message.toString()
        )
        if (logEvent.level === Log.LEVELS.DEBUG) {
            message.unshift('DEBUG')
            const finalMessage = [message.join(' ')]
            if (logEvent.extra) {
                if (Array.isArray(logEvent.extra)) {
                    finalMessage.push(...logEvent.extra)
                } else {
                    finalMessage.push(logEvent.extra.toString())
                }
            }
            console.debug(finalMessage.join('\n'))
        } else if (logEvent.level === Log.LEVELS.INFO) {
            // Keep the first part of the message always the same length
            message.unshift('INFO ')
            const finalMessage = [message.join(' ')]
            if (logEvent.extra) {
                if (Array.isArray(logEvent.extra)) {
                    finalMessage.push(...logEvent.extra)
                } else {
                    finalMessage.push(logEvent.extra.toString())
                }
            }
            console.info(finalMessage.join('\n'))
        } else if (logEvent.level === Log.LEVELS.WARN) {
            message.unshift('WARN ')
            const finalMessage = [message.join(' ')]
            if (logEvent.extra) {
                if (Array.isArray(logEvent.extra)) {
                    finalMessage.push(...logEvent.extra)
                } else {
                    finalMessage.push(logEvent.extra.toString())
                }
            }
            console.warn(finalMessage.join('\n'))
        } else if (logEvent.level === Log.LEVELS.ERROR) {
            message.unshift('ERROR')
            const finalMessage = [message.join(' ')]
            if (logEvent.extra) {
                if (Array.isArray(logEvent.extra)) {
                    finalMessage.push(...logEvent.extra)
                } else {
                    finalMessage.push(logEvent.extra.toString())
                }
            }
            console.error(finalMessage.join('\n'))
        }
    }

    /**
     * Register a worker that is using the Log to relay messages to the main thread.
     * @param worker - The worker to listen to and update print threshold changes to.
     */
    static registerWorker (worker: Worker) {
        const messageHandler = (message: MessageEvent) => {
            const { data } = message
            if (data.action === 'log' && data.level && data.message, data.scope) {
                this.add(data.level, data.message, data.scope, data.extra)
            } else if (data.action === 'terminate') {
                // Removing the listener from a terminated worker may not be necessary, but at least this gives a way
                // to do that.
                worker.removeEventListener('message', messageHandler)
            }
        }
        // Listen to log messages from the worker.
        worker.addEventListener('message', messageHandler)
    }

    /**
     * Remove all event listeners. If `owner` is given, only event listeners from that owner are removed, otherwise
     * event listeners from all owners are removed (i.e. all event listeners).
     * @param owner - Optional owner to remove listeners from.
     * @returns Number of event listeners removed.
     */
    static removeAllEventListeners (owner?: string) {
        if (!owner) {
            return this.eventListeners.splice(0).reduce((partial, item) => partial + item.levels.length, 0)
        }
        let rmCount = 0
        for (let i=0; i<this.eventListeners.length; i++) {
            if (this.eventListeners[i].owner === owner) {
                rmCount += this.eventListeners.splice(i, 1)[0].levels.length
                i--
            }
        }
        return rmCount
    }

    /**
     * Remove a listener that matches the given `level` (or levels). A given `owner` name is also required to match,
     * an empty owner will match listeners from named and unnammed owners.
     * @param level - Level or array of levels to match.
     * @param listener - The listener to remove.
     * @param owner - Optional name of the owner to match.
     * @returns The number of listeners that were removed.
     */
    static removeEventListeners (level: LogLevel | LogLevel[], listener: LogEventListener, owner?: string) {
        level = Array.isArray(level) ? level : [level]
        let rmCount = 0
        for (let i=0; i<Log.eventListeners.length; i++) {
            const evt = Log.eventListeners[i]
            if (evt.levels.length === level.length && evt.levels.every(l => level.includes(l))) {
                // Event listener levels match the given level(s), we can remove entire listener if a match.
                if (evt.listener === listener && (!owner || evt.owner === owner)) {
                    Log.eventListeners.splice(i, 1)
                    i--
                    rmCount++
                }
            } else {
                // Go through each event level.
                for (let j=0; j<evt.levels.length; j++) {
                    if (
                        level.includes(evt.levels[j]) &&
                        evt.listener === listener && (!owner || evt.owner === owner)
                    ) {
                        evt.levels.splice(j, 1)
                        j--
                        rmCount++
                    }
                    // Remove entire listener if no levels are left.
                    if (!evt.levels.length) {
                        Log.eventListeners.splice(i, 1)
                        i--
                        break
                    }
                }
            }
        }
        return rmCount
    }

    /**
     * Remove all events _at_ the given priority `level` from the log.
     * @param level - Level at which events will be removed.
     */
    static removeEventsAtLevel (level: LogLevel) {
        if (!Object.keys(Log.LEVELS).includes(level) || level === 'DISABLE') {
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
    static removeEventsBelowLevel (level: LogLevel) {
        if (!Object.keys(Log.LEVELS).includes(level) || level === 'DISABLE') {
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
    static removeScopeEventsAtLevel (scope: string, level: LogLevel) {
        if (!Object.keys(Log.LEVELS).includes(level) || level === 'DISABLE') {
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
        const clearEvent = new LogEvent(Log.LEVELS[level], '__clear', 'Log')
        Log.callEventListeners(level, clearEvent)
    }

    /**
     * Remove all events _below_ the given priority `level` in the given `scope` from the log.
     * @param scope - Scope of the events.
     * @param level - Level below which events will be removed (events at the level will remain).
     */
    static removeScopeEventsBelowLevel (scope: string, level: LogLevel) {
        if (!Object.keys(Log.LEVELS).includes(level) || level === 'DISABLE') {
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
        for (const [name, lvl] of Object.entries(Log.LEVELS) as [LogLevel, number][]) {
            if (lvl < Log.LEVELS[level]) {
                const clearEvent = new LogEvent(lvl, '__clear', 'Log')
                Log.callEventListeners(name, clearEvent)
            }
        }
    }

    /**
     * Set a new printing threshold level.
     * @param level - Print messages at or above this level to console.
     */
    static setPrintThreshold (level: LogLevel) {
        if (Object.keys(Log.LEVELS).includes(level)) {
            Log.printThreshold = Log.LEVELS[level]
            for (const worker of this.workers) {
                worker.postMessage({ action: 'log-set-print-threshold', level: level })
            }
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
    protected _extra: unknown
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

    constructor (level: number, message: string | string[], scope: string, extra?: unknown) {
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
