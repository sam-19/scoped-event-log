import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js'

// Shoelace base path
setBasePath('https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.20.1/dist/')
import '@shoelace-style/shoelace/dist/themes/dark.css'
import '@shoelace-style/shoelace/dist/themes/light.css'

// Shoelace components
import '@shoelace-style/shoelace/dist/components/button/button.js'
import '@shoelace-style/shoelace/dist/components/details/details.js'
import '@shoelace-style/shoelace/dist/components/divider/divider.js'
import '@shoelace-style/shoelace/dist/components/icon/icon.js'
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js'
import '@shoelace-style/shoelace/dist/components/option/option.js'
import '@shoelace-style/shoelace/dist/components/select/select.js'
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js'
import { Log, type LogEventProps } from '.'

type LogEvent = LogEventProps & {
  id: string
  expanded: boolean
}

const USED_IDS = new Set<string>()

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
        this.classList.remove('sl-theme-dark')
        this.#theme = 'light'
    } else if (this.mode === 'dark') {
        this.classList.add('sl-theme-dark')
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
      <div class="component ${this.#theme}-mode sl-theme-${this.#theme}" part="component">
        <sl-details summary="Filters">
          <div class="option" part="option">
            <sl-select
              class="level"
              clearable
              hoist
              label="Priority"
              multiple
              part="level"
              placeholder="All"
              value=${this.displayPriorities.join(' ')}
              @sl-change=${this.setdisplayPriorities}
            >
              <sl-option value="3">Error</sl-option>
              <sl-option value="2">Warning</sl-option>
              <sl-option value="1">Info</sl-option>
              ${this.developmentMode
                ? html`<sl-option value="0">Debug</sl-option>`
                : nothing
              }
            </sl-select>
            <sl-select
              class="source"
              clearable
              hoist
              label="Source"
              multiple
              part="source"
              placeholder="All"
              value=${this.displaySources.join(' ')}
              @sl-change=${this.setdisplaySources}
            >
              ${ repeat(this.#logSources, (source) => `filter-log-source-${source}`, (source, _idx) => html`
                  <sl-option value=${source.replace(/ /g, '_')}>${source}</sl-option>
                `)
              }
            </sl-select>
          </div>
        </sl-details>
        <sl-divider part="divider"></sl-divider>
        <div class="nav" part="nav">
          <div class="range" part="range">
            ${(this.pageNumber - 1)*this.eventsPerPage + 1}
            -
            ${Math.min(this.pageNumber*this.eventsPerPage, this.filteredEvents.length)}
            /
            ${this.filteredEvents.length}
          </div>
          <div class="arrows" part="arrows">
            <sl-tooltip content="Previous page">
              <sl-icon-button
                name="chevron-left"
                ?disabled=${this.pageNumber <= 1}
                part="previous-page"
                @click=${() => {
                  this.pageNumber--
                }}
              ></sl-icon-button>
            </sl-tooltip>
            <sl-tooltip content="Next page">
              <sl-icon-button
                name="chevron-right"
                ?disabled=${this.pageNumber*this.eventsPerPage >= this.filteredEvents.length}
                part="next-page"
                @click=${() => {
                  this.pageNumber++
                }}
              ></sl-icon-button>
            </sl-tooltip>
          </div>
          <div class="order" part="order">
            Order:
            <sl-tooltip
              content=${this.#eventOrder === -1 ? 'Oldest to newest' : 'Newest to oldest'}
            >
              <sl-icon-button
                name="arrow-${this.#eventOrder === 1 ? 'up' : 'down'}"
                @click=${() => {
                  this.#eventOrder = this.#eventOrder === -1 ? 1 : -1
                  this.filterEvents()
                }}
              ></sl-icon-button>
            </sl-tooltip>
          </div>
        </div>
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
                      <sl-tooltip content="Priority: ${this.labelForLevel(event.level)}">
                        <sl-icon
                          name=${this.iconForLevel(event.level)}
                          style="color: var(--icon-${this.colorForLevel(event.level)})"
                        ></sl-icon>
                      </sl-tooltip>
                    </div>
                    <div class="scope" part="scope">
                      <sl-tooltip content="Scope: ${event.scope}">
                        <div class="oneliner">${event.scope}</div>
                      </sl-tooltip>
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
            })
          }
        </ul>
      </div>
    `
  }

  /**
   * Apply the selected mode to the component.
   * @param mode The mode to apply, either 'dark' or 'light'.
   */
  private _applyMode (mode: 'dark' | 'light') {
    if (mode === 'dark') {
      this.classList.add('sl-theme-dark')
      this.#theme = 'dark'
      this.requestUpdate()
    } else {
      this.classList.remove('sl-theme-dark')
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
      max-height: 100%;
      overflow: hidden;
    }
    .level {
      min-width: 16em;
    }
    sl-select::part(form-control-label) {
      font-size: 0.9em;
      color: var(--text-faint);
    }
    .option {
      display: flex;
      gap: 1em;
    }
    .nav {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      height: 2em;
      line-height: 2em;
      font-size: 0.9em;
      color: var(--text-minor);
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
        display: flex;
        gap: 0.5em;
        margin-left: auto;
      }
    .log {
      padding: 0;
      height: 100%;
      overflow: auto;
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
        flex: 0;
      }
        .icon sl-icon {
          position: relative;
          top: 0.125em;
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
