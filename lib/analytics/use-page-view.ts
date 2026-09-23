import { useEffect } from "react";
import { trackDisplay, type TrackParams } from "./track";

/**
 * Records one page-view (a "display" event) per mount. This is an MPA where
 * every route is a fresh document, so a single mount maps to one real visit.
 */
export function usePageView(name = "page_view", params?: TrackParams): void {
  useEffect(() => {
    trackDisplay(name, {
      referrer: document.referrer || undefined,
      title: document.title || undefined,
      ...params,
    });
    // Runs once per document load; deliberately not re-run on prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
