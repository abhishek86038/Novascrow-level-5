import * as Sentry from "@sentry/react";

export function initMonitoring() {
  Sentry.init({
    dsn: "https://mock-dsn@o0.ingest.sentry.io/0", // Mock DSN for demonstration
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
  });
  console.log("Sentry monitoring initialized");
}

export function captureError(error: Error | string, context: Record<string, any> = {}) {
  console.error("[Sentry Mock Capture]", error, context);
  Sentry.captureException(typeof error === 'string' ? new Error(error) : error, {
    extra: context
  });
}
