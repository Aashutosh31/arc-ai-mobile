/**
 * Static mirror of the ARC-AI server's native agent tool registry
 * (`server/tools/*.js`). The model invokes these automatically during a
 * conversation; this catalog exists so the app can *show* the user what ARC is
 * able to do. Keep in sync with `server/tools/` (22 tools).
 */
export interface ToolCatalogEntry {
  /** Model-facing function name (`schema.function.name`). */
  name: string;
  description: string;
  /** Required/optional parameter names, for display only. */
  params: string[];
  /** Whether guests are allowed to trigger the tool. */
  guestAllowed: boolean;
}

export interface ToolCategory {
  id: string;
  label: string;
  icon: string;
  tools: ToolCatalogEntry[];
}

export const TOOL_CATALOG: ToolCategory[] = [
  {
    id: 'web',
    label: 'Web & Research',
    icon: 'globe-outline',
    tools: [
      {
        name: 'webSearch',
        description: 'Search Wikipedia for a topic.',
        params: ['query'],
        guestAllowed: false,
      },
      {
        name: 'scrapeWebsite',
        description: 'Fetch a page and extract its readable text.',
        params: ['url'],
        guestAllowed: false,
      },
      {
        name: 'openWebsite',
        description: 'Open a URL in the device browser.',
        params: ['url', 'siteName'],
        guestAllowed: true,
      },
      {
        name: 'getTopNews',
        description: 'Fetch the latest headlines for a topic and region.',
        params: ['topic', 'region', 'limit'],
        guestAllowed: true,
      },
      {
        name: 'deepResearchSwarm',
        description: 'Run a multi-agent deep research report.',
        params: ['topic'],
        guestAllowed: false,
      },
    ],
  },
  {
    id: 'media',
    label: 'Media',
    icon: 'play-circle-outline',
    tools: [
      {
        name: 'playMedia',
        description: 'Find and play a video (YouTube).',
        params: ['searchQuery'],
        guestAllowed: true,
      },
      {
        name: 'stopMedia',
        description: 'Stop the current media playback.',
        params: [],
        guestAllowed: true,
      },
    ],
  },
  {
    id: 'calendar',
    label: 'Calendar & Tasks',
    icon: 'calendar-outline',
    tools: [
      {
        name: 'checkCalendar',
        description: 'Read upcoming events from Google Calendar.',
        params: ['timeMin', 'timeMax', 'maxResults', 'calendarId'],
        guestAllowed: true,
      },
      {
        name: 'scheduleMeeting',
        description: 'Create a Google Calendar event.',
        params: ['summary', 'startDateTime', 'endDateTime'],
        guestAllowed: false,
      },
      {
        name: 'createReminder',
        description: 'Create a one-off reminder task.',
        params: ['taskDescription'],
        guestAllowed: true,
      },
      {
        name: 'setReminder',
        description: 'Schedule a recurring reminder (cron).',
        params: ['reminderText', 'cronExpression'],
        guestAllowed: true,
      },
      {
        name: 'stopReminder',
        description: 'Cancel all of your scheduled reminders.',
        params: [],
        guestAllowed: true,
      },
    ],
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: 'sparkles-outline',
    tools: [
      {
        name: 'recallMemory',
        description: 'Search your long-term memory.',
        params: ['searchQuery'],
        guestAllowed: true,
      },
      {
        name: 'memorize',
        description: 'Store an entry in long-term memory.',
        params: ['content', 'tags'],
        guestAllowed: false,
      },
      {
        name: 'storeUserFact',
        description: 'Save a durable fact about you.',
        params: ['fact', 'category'],
        guestAllowed: false,
      },
    ],
  },
  {
    id: 'comms',
    label: 'Communication',
    icon: 'paper-plane-outline',
    tools: [
      {
        name: 'sendEmail',
        description: 'Send an email.',
        params: ['recipient', 'subject', 'body'],
        guestAllowed: false,
      },
      {
        name: 'sendWhatsAppMessage',
        description: 'Send a WhatsApp message.',
        params: ['recipientName', 'message'],
        guestAllowed: false,
      },
    ],
  },
  {
    id: 'utility',
    label: 'Utilities',
    icon: 'construct-outline',
    tools: [
      {
        name: 'getTime',
        description: 'Get the current date and time.',
        params: [],
        guestAllowed: true,
      },
      {
        name: 'getWeather',
        description: 'Get real-time weather for a location.',
        params: ['location'],
        guestAllowed: true,
      },
      {
        name: 'copyToClipboard',
        description: 'Copy text to the device clipboard.',
        params: ['text'],
        guestAllowed: true,
      },
      {
        name: 'executeCode',
        description: 'Run JavaScript in a sandbox.',
        params: ['code'],
        guestAllowed: false,
      },
    ],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: 'color-palette-outline',
    tools: [
      {
        name: 'changeTheme',
        description: 'Switch the app theme.',
        params: ['theme'],
        guestAllowed: true,
      },
    ],
  },
];

export const TOOL_COUNT = TOOL_CATALOG.reduce((n, c) => n + c.tools.length, 0);
