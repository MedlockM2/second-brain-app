/**
 * English catalogue of the web app's own labels — the reference.
 *
 * Only what the web app says and the mobile app does not: the bar, the install
 * page. Everything shared (sign-in, reading language, errors) comes from
 * `@media-summarizer/core/i18n`. Every key declared here has to appear in the
 * ten other catalogues, which `WebCatalog` makes a `tsc` error.
 */
export const en = {
  "nav.mainA11y": "Main navigation",
  "nav.library": "Library",
  "nav.unsorted": "Unsorted · {count}",
  "nav.unsortedNoCount": "Unsorted",
  "nav.searchPlaceholder": "Search the text of your sources",
  "nav.add": "Add",
  "nav.themeToDark": "Switch to dark theme",
  "nav.themeToLight": "Switch to light theme",
  "nav.account": "My account",
  "install.lead": "On a phone, Deepn is an app: install it to save, read and review your sources.",
  "install.appStore": "Download on the App Store",
  "install.googlePlay": "Get it on Google Play",
  "session.unreachable": "Deepn can't be reached right now. Check your connection and try again.",
  "home.rowBackA11y": "Previous",
  "home.rowForwardA11y": "Next",
  "home.folderLabel": "Folder",
  "home.importFailed": "Import failed",
  "home.emptyHint": "Add a link or drop a file, and it will appear here.",
  "library.folderTotal": "{count} in total",
  "library.loadMore": "Show more",
  "library.end": "End of the library",
  "pane.discussion": "Discussion",
  "pane.discussionLocked": "The discussion opens as soon as the text of this media is ready.",
  "pane.aiLocked": "Generation opens as soon as the text of this media is ready.",
  "pane.collapse": "Collapse this panel",
  "pane.expand": "Expand this panel",
  "pane.history": "History",
  "artifact.showAnswer": "Show the answer",
  "pane.discussionUnavailable": "Nothing to discuss: the text of this media could not be imported.",
  "pane.aiUnavailable": "Nothing to generate: the text of this media could not be imported.",
  "media.timeoutHint": "Check again now, or come back later.",
} as const;
