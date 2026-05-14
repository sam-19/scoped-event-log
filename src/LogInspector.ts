import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'

// WebAwesome imports
import '@awesome.me/webawesome/dist/styles/themes/default.css'

// Shoelace components
import '@awesome.me/webawesome/dist/components/button/button.js'
import '@awesome.me/webawesome/dist/components/details/details.js'
import '@awesome.me/webawesome/dist/components/divider/divider.js'
import '@awesome.me/webawesome/dist/components/option/option.js'
import '@awesome.me/webawesome/dist/components/scroller/scroller.js'
import '@awesome.me/webawesome/dist/components/select/select.js'
import '@awesome.me/webawesome/dist/components/tooltip/tooltip.js'
import { Log, type LogEventProps } from './index.js'

type LogEvent = LogEventProps & {
  id: string
  expanded: boolean
}

const USED_IDS = new Set<string>()

// Inline SVG icons, used in place of WebAwesome's `wa-icon` here so the inspector doesn't
// depend on an icon library being registered in the host app (the previous build relied on
// FontAwesome Pro, which requires a paid subscription). Sized via `1em` so they inherit the
// surrounding button's font size; coloured via `currentColor` so theme styling propagates.
const ICON_CHEVRON_LEFT = html`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M15.5 19l-7-7 7-7 1.4 1.4L11.3 12l5.6 5.6z"/></svg>`
const ICON_CHEVRON_RIGHT = html`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M8.5 5l7 7-7 7-1.4-1.4L12.7 12 7.1 6.4z"/></svg>`
const ICON_ARROW_DOWN = html`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M11 4v12.2l-5.6-5.6L4 12l8 8 8-8-1.4-1.4-5.6 5.6V4z"/></svg>`
const ICON_ARROW_UP = html`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M11 20V7.8l-5.6 5.6L4 12l8-8 8 8-1.4 1.4L13 7.8V20z"/></svg>`

// Per-log-level priority icons. Rendered next to each event row, coloured via `currentColor`
// inherited from `style="color: var(--icon-<level>)"` on the wrapping <svg>. `id` is set on
// each so the adjacent `<wa-tooltip for=...>` can target it.
const renderLevelIcon = (id: string, color: string, level: number) => {
    // INFO (level 1): circle with 'i' glyph.
    if (level === 1) {
        return html`<svg id=${id} viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" style="color: var(--icon-${color})" aria-hidden="true"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm-1-13h2v2h-2zm0 4h2v6h-2z"/></svg>`
    }
    // WARN (level 2): triangle with '!' glyph.
    if (level === 2) {
        return html`<svg id=${id} viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" style="color: var(--icon-${color})" aria-hidden="true"><path d="M12 5.99 19.53 19H4.47L12 5.99M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v5h2v-5z"/></svg>`
    }
    // ERROR (level 3): octagon with 'x' glyph.
    if (level === 3) {
        return html`<svg id=${id} viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" style="color: var(--icon-${color})" aria-hidden="true"><path d="M7.86 2 2 7.86v8.28L7.86 22h8.28L22 16.14V7.86L16.14 2H7.86zm.83 2h6.62L20 8.69v6.62L15.31 20H8.69L4 15.31V8.69L8.69 4zm6.6 4L12 11.29 8.71 8 7.29 9.41 10.59 12.71 7.29 16 8.71 17.41 12 14.12 15.29 17.41 16.71 16 13.41 12.71 16.71 9.41 15.29 8z"/></svg>`
    }
    // DEBUG (level 0, default): bug glyph.
    return html`<svg id=${id} viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" style="color: var(--icon-${color})" aria-hidden="true"><path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C13 5.06 12.5 5 12 5s-1 .06-1.42.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z"/></svg>`
}

/**
 * Log inspector element.
 * This component is used to display log events in a list format.
 * It allows filtering by priority and source, and supports pagination.
 */
@customElement('log-inspector')
export class LogInspector extends LitElement {
  /** Ordering if log events.
   *  - 1 is oldest to newest.
   *  - -1 is newest to oldest. */
  #eventOrder: 1 | -1 = 1
  /** Info open status. */
  #infoOpen: Record<string, boolean> = {}
  /** List of log events in the inspector. */
  #logEvents: LogEvent[] = []
  /** List of source for which log events are available. */
  #logSources: string[] = []
  /** Current theme. */
  #theme: 'dark' | 'light' = 'light'
  /**
   * Crate a new log inspector element.
   * This will automatically add event listeners to the log instance.
   * @param log The log instance to use.
   * @param developmentMode Is the app in development mode?
   * @param eventsPerPage The number of events to show per page.
   * @param displayPriorities The priority levels to filter.
   * @param displaySources The sources to filter.
   * @param pageNumber The current page number.
   */
  constructor () {
    super()
    const eventLevels = ['ERROR', 'INFO', 'WARN'] as ("DEBUG" | "ERROR" | "INFO" | "WARN")[]
    // Apply theme and monitor for mode changes.
    if (this.mode === 'light') {
        this.classList.remove('wa-dark')
        this.#theme = 'light'
    } else if (this.mode === 'dark') {
        this.classList.add('wa-dark')
        this.#theme = 'dark'
    } else {
      this._applyMode(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (this.mode === 'system') {
          this._applyMode(event.matches ? 'dark' : 'light')
        }
      })
    }
    requestAnimationFrame(() => {
      // Attributes need time to be initialized.
      if (this.developmentMode) {
        eventLevels.push('DEBUG')
      }
      this.useLog.addEventListener(eventLevels, _event => {
        this.refreshEvents()
      })
      this.refreshEvents()
    })
  }
  /**
   * The log events to display.
   */
  @state()
  private filteredEvents: LogEvent[] = []
  get pageEvents () {
    return this.filteredEvents.slice(
      (this.pageNumber - 1) * this.eventsPerPage,
      this.pageNumber * this.eventsPerPage
    )
  }
  /**
   * Is the app in production mode?
   * - `development-mode` as an attribute.
   * - `developmentMode` as a property.
   * @default false
   */
  @property({ type: Boolean, attribute: 'development-mode' })
  developmentMode = false
  /**
   * Displayed priority levels. Empty means all priorities.
   * - `display-priorities` as an attribute.
   * - `displayPriorities` as a property.
   * @default [] (all priorities)
   */
  @property({ type: Array, attribute: 'display-priorities' })
  displayPriorities: number[] = []
  /**
   * Displayed sources. Empty means all sources are displayed.
   * - `display-sources` as an attribute.
   * - `displaySources` as a property.
   * @default [] (all sources)
   */
  @property({ type: Array, attribute: 'display-sources' })
  displaySources: string[] = []
  /**
   * The number of events to show per page.
   * - `events-per-page` as an attribute.
   * - `eventsPerPage` as a property.
   * @default 25
   */
  @property({ type: Number, attribute: 'events-per-page' })
  eventsPerPage = 25
  /**
   * Override the application mode.
   * @default 'system'
   */
  @property({ type: String, attribute: 'mode' })
  mode: 'dark' | 'light' | 'system' = 'system'
  /**
   * The current page number.
   * - `page-number` as an attribute.
   * - `pageNumber` as a property.
   * @default 1
   */
  @property({ type: Number, attribute: 'page-number' })
  pageNumber = 1
  /**
   * The log instance to use.
   * - `log` as an attribute.
   * - `useLog` as a property.
   * @default Log (global Log instance)
   */
  @property({ type: Object, attribute: 'log' })
  useLog: typeof Log = Log

  render() {
    return html`
      <div class="component ${this.#theme}-mode wa-${this.#theme}" part="component">
        <wa-details summary="Filters">
          <div class="option" part="option">
            <wa-select
              class="level"
              clearable
              hoist
              label="Priority"
              multiple
              part="level"
              placeholder="All"
              .value=${this.displayPriorities.map((level) => level.toString())}
              @change=${this.setdisplayPriorities}
            >
              <wa-option value="3">Error</wa-option>
              <wa-option value="2">Warning</wa-option>
              <wa-option value="1">Info</wa-option>
              ${this.developmentMode
                ? html`<wa-option value="0">Debug</wa-option>`
                : nothing
              }
            </wa-select>
            <wa-select
              class="source"
              clearable
              hoist
              label="Source"
              multiple
              part="source"
              placeholder="All"
              .value=${this.displaySources}
              @change=${this.setdisplaySources}
            >
              ${ repeat(this.#logSources, (source) => `filter-log-source-${source}`, (source, _idx) => html`
                  <wa-option value=${source.replace(/ /g, '_')}>${source}</wa-option>
                `)
              }
            </wa-select>
          </div>
        </wa-details>
        <wa-divider class="divider" part="divider"></wa-divider>
        <div class="nav" part="nav">
          <div class="range" part="range">
            ${(this.pageNumber - 1)*this.eventsPerPage + 1}
            -
            ${Math.min(this.pageNumber*this.eventsPerPage, this.filteredEvents.length)}
            /
            ${this.filteredEvents.length}
          </div>
          <div class="arrows" part="arrows">
            <wa-button
              appearance="plain"
              id="previous-page-button"
              ?disabled=${this.pageNumber <= 1}
              part="previous-page"
              size="small"
              @click=${() => {
                this.pageNumber--
              }}
            >
              ${ICON_CHEVRON_LEFT}
            </wa-button>
            <wa-tooltip for="previous-page-button">Previous page</wa-tooltip>
            <wa-button
              appearance="plain"
              id="next-page-button"
              ?disabled=${this.pageNumber*this.eventsPerPage >= this.filteredEvents.length}
              part="next-page"
              size="small"
              @click=${() => {
                this.pageNumber++
              }}
            >
              ${ICON_CHEVRON_RIGHT}
            </wa-button>
            <wa-tooltip for="next-page-button">Next page</wa-tooltip>
          </div>
          <div class="order" part="order">
            Order:
            <wa-button
              appearance="plain"
              id="order-button"
              size="small"
              @click=${() => {
                this.#eventOrder = this.#eventOrder === -1 ? 1 : -1
                this.filterEvents()
              }}
            >
              ${this.#eventOrder === -1 ? ICON_ARROW_DOWN : ICON_ARROW_UP}
            </wa-button>
            <wa-tooltip for="order-button">
              ${this.#eventOrder === -1 ? 'Oldest to newest' : 'Newest to oldest'}
            </wa-tooltip>
          </div>
        </div>
        <wa-scroller class="scroller" orientation="vertical" part="scroller">
          <ul class="log" part="log">
            ${ repeat(this.pageEvents, (event) => `log-event-${event.id}`, (event, _idx) => {
              return html`
                <li
                  class="row${event.expanded ? ' expanded' : ''}"
                  part="row"
                  style="border-color: var(--border-${this.colorForLevel(event.level)})"
                  @click=${this.toggleExpand(event)}
                >
                  <div class="meta" part="meta">
                    <div class="icon" part="icon">
                      ${renderLevelIcon(`icon-${event.id}`, this.colorForLevel(event.level), event.level)}
                      <wa-tooltip for="${`icon-${event.id}`}">
                        Priority: ${this.labelForLevel(event.level)}
                      </wa-tooltip>
                    </div>
                    <div class="scope" part="scope">
                      <div class="oneliner" id="${`scope-${event.id}`}">${event.scope}</div>
                      <wa-tooltip for="${`scope-${event.id}`}">
                        Scope: ${event.scope}
                      </wa-tooltip>
                    </div>
                  </div>
                  <div class="message" part="message">
                    <span class="${event.expanded ? '' : 'oneliner'}">${
                      Array.isArray(event.message) ? event.message.join('\n') : event.message
                    }</span>
                    <span class="time" title="Timestamp: ${event.time.date.toLocaleString()}">
                      ${
                        event.time.date.getHours()
                      }:${
                        event.time.date.getMinutes().toString().padStart(2, '0')
                      }:${
                        event.time.date.getSeconds().toString().padStart(2, '0')
                      }
                    </span>
                    ${ event.expanded && event.extra
                      ? html`<hr style="border-color: var(--border-${this.colorForLevel(event.level)})" />`
                      : ''
                    }
                    ${ event.expanded && event.extra
                      ? repeat(Array.isArray(event.extra) ? event.extra : [event.extra],
                        (_extra) => `log-event-${event.id}-extra`, (extra, _idy) => {
                          return html`<pre>${extra}</pre>`
                      })
                      : ''
                    }
                  </div>
                </li>
              `
            })}
          </ul>
        </wa-scroller>
      </div>
    `
  }

  /**
   * Apply the selected mode to the component.
   * @param mode The mode to apply, either 'dark' or 'light'.
   */
  private _applyMode (mode: 'dark' | 'light') {
    if (mode === 'dark') {
      this.classList.add('wa-dark')
      this.#theme = 'dark'
      this.requestUpdate()
    } else {
      this.classList.remove('wa-dark')
      this.#theme = 'light'
      this.requestUpdate()
    }
  }
  /**
   * Create an identifier that is unique among the identifiers created with this method.
   * @returns Unique identifier as a string.
   */
  private _createUniqueId () {
    let retries = 100
    while (retries > 0) {
      const id = (Date.now() + Math.random()).toString(36)
      if (!USED_IDS.has(id)) {
        USED_IDS.add(id)
        return id
      }
      retries--
    }
    const errorId = `id-error-${USED_IDS.size}`
    USED_IDS.add(errorId)
    return errorId
  }

  /**
   * Get the color for a given level.
   * @param level The level of the event.
   * @returns The color as a string.
   */
  colorForLevel (level: number) {
    switch (level) {
      case 1:
        return 'default'
      case 2:
        return 'warning'
      case 3:
        return 'error'
      default:
        return 'minor'
    }
  }
  /**
   * Filter the log events based on the selected filters.
   */
  filterEvents () {
    this.filteredEvents = this.#logEvents.filter((event) => {
      if (this.displayPriorities.length && !this.displayPriorities.includes(event.level)) {
        return false
      }
      if (this.displaySources.length && !this.displaySources.includes(event.scope.replace(/ /g, '_'))) {
        return false
      }
      return true
    })
    this.filteredEvents.sort(
      (a, b) => this.#eventOrder*b.time.date.valueOf() - this.#eventOrder*a.time.date.valueOf()
    )
    this.pageNumber = 1
  }
  /**
   * Get the icon name for a given level.
   * @param level The level of the event.
   * @returns The icon name as a string.
   */
  iconForLevel (level: number) {
    switch (level) {
      case 1:
        return 'info-circle'
      case 2:
        return 'exclamation-triangle'
      case 3:
        return 'x-octagon'
      default:
        return 'bug'
    }
  }
  /**
   * Get the label for a given level.
   * @param level The level of the event.
   * @returns The label as a string.
   */
  labelForLevel (level: number) {
    switch (level) {
      case 1:
        return 'Info'
      case 2:
        return 'Warning'
      case 3:
        return 'Error'
      default:
        return 'Debug'
    }
  }

  /**
   * Refresh the log events and sources.
   */
  refreshEvents () {
    this.#logEvents.length = 0
    this.#logSources.length = 0
    for (const ev of this.useLog.getAllEventsAtOrAboveLevel(this.developmentMode ? "DEBUG" : "INFO")) {
      this.#logEvents.push(
        Object.assign(ev, {
          id: this._createUniqueId(),
          expanded: false,
        })
      )
      if (!this.#logSources.includes(ev.scope)) {
        this.#logSources.push(ev.scope)
      }
    }
    this.#logSources.sort()
    this.filterEvents()
  }

  setdisplayPriorities (event: CustomEvent) {
    this.displayPriorities = []
    for (const level of (event.target as HTMLInputElement).value) {
      this.displayPriorities.push(parseInt(level))
    }
    this.filterEvents()
  }

  setdisplaySources (event: CustomEvent) {
    this.displaySources = []
    for (const source of (event.target as HTMLInputElement).value) {
      this.displaySources.push(source)
    }
    this.filterEvents()
  }

  toggleExpand (logEvent: LogEvent) {
    // This has to return a function of we want to use the custom event.
    return (_event: PointerEvent) => {
      logEvent.expanded = !logEvent.expanded
      this.requestUpdate()
    }
  }

  toggleInfo (field: string, value?: boolean) {
    if (value !== undefined) {
      this.#infoOpen[field] = value
    } else if (!this.#infoOpen[field]) {
      // If false or doesn't exist yet.
      this.#infoOpen[field] = true
    } else {
      this.#infoOpen[field] = false
    }
  }

  variantForLevel (level: number) {
    switch (level) {
      case 1:
        return 'light'
      case 2:
        return 'regular'
      case 3:
        return 'solid'
      default:
        return 'light'
    }
  }

  static styles = css`
    /* Global element styles */
    :host {
      font-family: sans-serif;
    }
    .dark-mode {
      --background-default: #111;
      --background-focus: #181818;
      --background-highlight: #222;
      --border-default: #888;
      --border-faint: #666;
      --border-minor: #444;
      --border-highlight: #36f;
      --border-warning: #d62;
      --border-error: #c00;
      --icon-default: #aaa;
      --icon-faint: #777;
      --icon-minor: #999;
      --icon-highlight: #248;
      --icon-warning: #d62;
      --icon-error: #c00;
      --text-default: #ccc;
      --text-faint: #999;
      --text-minor: #aaa;
      --text-highlight: #248;
      --text-warning: #d62;
      --text-error: #c00;
    }
    .light-mode {
      --background-default: #fff;
      --background-focus: #f8f8ff;
      --background-highlight: #f9f9f9;
      --border-default: #888;
      --border-faint: #ccc;
      --border-minor: #aaa;
      --border-highlight: #36f;
      --border-warning: #d62;
      --border-error: #c00;
      --icon-default: #333;
      --icon-faint: #999;
      --icon-minor: #666;
      --icon-highlight: #248;
      --icon-warning: #d62;
      --icon-error: #c00;
      --text-default: #333;
      --text-faint: #999;
      --text-minor: #666;
      --text-highlight: #248;
      --text-warning: #d62;
      --text-error: #c00;
    }
    /* General styles */
    .hidden {
      display: none;
    }
    .oneliner {
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    /* Component styles */
    .component {
      background-color: var(--background-default);
      color: var(--text-default);
      display: flex;
      flex-direction: column;
      max-height: 100%;
      overflow: hidden;
    }
    .level {
      min-width: 16em;
    }
    wa-select::part(form-control-label) {
      font-size: 0.9em;
      color: var(--text-faint);
    }
    .option {
      display: flex;
      gap: 1em;
    }
    .divider {
      margin-bottom: 0.25rem;
    }
    .nav {
      align-items: center;
      color: var(--text-minor);
      display: flex;
      flex: 0 0 2.75rem;
      flex-wrap: nowrap;
      font-size: 0.9em;
      height: 2em;
      line-height: 2em;
      padding-bottom: 0.25rem;
    }
      .nav .range {
        margin-left: 0.25em;
        min-width: 7.5em;
      }
      .arrows {
        display: flex;
        gap: 0.5em;
      }
      .nav .order {
        align-items: center;
        display: flex;
        gap: 0.5em;
        margin-left: auto;
      }
    .scroller {
      flex: 1;
      overflow: hidden;
    }
    .log {
      margin: 0;
      padding: 0 0.5em 0 0;
    }
    .row {
      display: flex;
      flex-wrap: nowrap;
      height: 1.75em;
      border: 1px solid var(--border-default);
      border-radius: 0.25em;
      margin: 0.25em 0;
      padding: 0.5em;
      line-height: 1.75em;
      cursor: pointer;
    }
      .row.expanded {
        height: auto;
      }
      .row:hover {
        background-color: var(--background-highlight);
      }
      .meta {
        position: relative;
        flex: 0;
        display: flex;
        flex-wrap: nowrap;
      }
      .icon {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .scope {
        flex-shrink: 1;
        max-width: 10em;
      }
        .scope div {
          border-left: 1px solid var(--border-faint);
          border-right: 1px solid var(--border-faint);
          margin: 0 0.5em;
          padding: 0 0.5em;
        }
      .message {
        position: relative;
        flex: 1;
        padding-right: 0.25em;
        overflow: hidden;
      }
        .message span {
          display: inline-block;
          white-space: pre-line;
          max-width: calc(100% - 4.5em);
        }
        .message .time {
          position: absolute;
          top: 0;
          right: 0.5em;
          height: 100%;
          text-align: right;
          font-size: 0.9em;
          white-space: nowrap;
          color: var(--text-minor);
        }
        .message pre {
          white-space: pre-wrap;
          margin: 1em 0 0.25em 0;
          line-height: 1.5em;
        }
      .message hr {
        margin: 0.5em 0;
        border: none;
        border-top: 1px solid;
      }
    .source {
      flex: 1;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'log-inspector': LogInspector
  }
}
