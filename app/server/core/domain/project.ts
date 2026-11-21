export interface Project {
  /** Stable id; also the key used by the live status endpoint. */
  id: string;
  name: string;
  /** Public URL. Must be absolute — it is fetched for the status check. */
  url: string;
  /** One line on what it does, shown on the card. */
  tagline: string;
  /** A few sentences of detail, shown under the tagline. */
  description: string;
  /** Shown as pills on the card. */
  tech: string[];
  /** Optional screenshot/preview image. Falls back to a generated tile. */
  image?: string;
  /**
   * URL to screenshot, when `url` itself renders nothing useful — e.g. an
   * index page that only redirects. Capture only; the card still links to
   * `url` and the uptime check still pings `url`.
   */
  shotUrl?: string;
  /** Tailwind gradient classes for the fallback tile. */
  accent: string;
  /** Rough state, so retired work can stay listed honestly. */
  status: "live" | "wip" | "archived";
  /** Year work started, for the timeline ordering. */
  since?: string;
  /** Hand-maintained highlights, e.g. "21 pages", "5k+ users". */
  highlights?: string[];
  /** Skip the uptime ping for sites that block it. */
  skipStatusCheck?: boolean;
}
