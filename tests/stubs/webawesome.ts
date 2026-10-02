/**
 * Stand-in for the WebAwesome modules the inspector imports for their side effect of defining a
 * custom element. The real components render against browser APIs jsdom does not implement, and a
 * failure inside one of them says nothing about the element under test; left undefined, they render
 * as inert unknown elements and the inspector's own template is unaffected.
 * @package    scoped-event-log
 * @copyright  2026 Sampsa Lohi
 * @license    MIT
 */

export {}
