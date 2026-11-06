/**
 * What a bug report carries to lead to Sentry (task-612): the last event the
 * app sent in this session, and the exact bundle that was running.
 *
 * Each value is an identifier with a fixed shape, and the API refuses any
 * other with a 422 (`CreateBugReportRequest`). A value that does not match is
 * left out here rather than allowed to cost the user their report.
 */
export type BugReportDiagnostics = {
  sentry_event_id?: string;
  source_app_build?: string;
  ota_update_id?: string;
};

const EVENT_ID = /^[0-9a-f]{32}$/i;
const BUILD = /^[0-9A-Za-z][0-9A-Za-z._-]{0,31}$/;
const UPDATE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bugReportDiagnostics(values: {
  eventId?: string | null;
  build?: string | null;
  updateId?: string | null;
}): BugReportDiagnostics {
  const diagnostics: BugReportDiagnostics = {};
  if (values.eventId && EVENT_ID.test(values.eventId)) {
    diagnostics.sentry_event_id = values.eventId.toLowerCase();
  }
  if (values.build && BUILD.test(values.build)) diagnostics.source_app_build = values.build;
  if (values.updateId && UPDATE_ID.test(values.updateId)) diagnostics.ota_update_id = values.updateId;
  return diagnostics;
}
