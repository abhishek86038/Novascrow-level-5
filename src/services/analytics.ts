export function trackEvent(eventName: string, props: Record<string, any> = {}) {
  try {
    if (typeof window !== "undefined" && (window as any).plausible) {
      (window as any).plausible(eventName, { props });
    } else {
      console.log(`[Analytics Mock] Event: ${eventName}`, props);
    }
  } catch (err) {
    console.error("Failed to track event:", err);
  }
}
