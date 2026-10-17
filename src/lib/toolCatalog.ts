/**
 * Static mirror of the ARC-AI server's native agent tool registry
 * (`server/tools/*.js`). The model invokes these automatically during a
 * conversation; this catalog exists so the app can *show* the user what ARC is
 * able to do and let them try each one. Keep in sync with `server/tools/`
 * (22 tools).
 */
export interface ToolCatalogEntry {
  /** Model-facing function name (`schema.function.name`). */
  name: string;
  description: string;
  /** Required/optional parameter names, for display only. */
  params: string[];
  /** Whether guests are allowed to trigger the tool. */
  guestAllowed: boolean;
  /** Example prompt dropped into the composer by "Try it". */
  example: string;
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
        example: 'Search the web for the latest AI news',
      },
      {
        name: 'scrapeWebsite',
        description: 'Fetch a page and extract its readable text.',
        params: ['url'],
        guestAllowed: false,
        example: 'Summarize this article: https://example.com',
      },
      {
        name: 'openWebsite',
        description: 'Open a URL in the device browser.',
        params: ['url', 'siteName'],
        guestAllowed: true,
        example: 'Open youtube.com for me',
      },
      {
        name: 'getTopNews',
        description: 'Fetch the latest headlines for a topic and region.',
        params: ['topic', 'region', 'limit'],
        guestAllowed: true,
        example: 'Top news headlines right now?',
      },
      {
        name: 'deepResearchSwarm',
        description: 'Run a multi-agent deep research report.',
        params: ['topic'],
        guestAllowed: false,
        example: 'Research solid-state batteries in depth',
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
        example: 'Play some lo-fi music',
      },
      {
        name: 'stopMedia',
        description: 'Stop the current media playback.',
        params: [],
        guestAllowed: true,
        example: 'Stop the music',
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
        example: 'What is on my calendar tomorrow?',
      },
      {
        name: 'scheduleMeeting',
        description: 'Create a Google Calendar event.',
        params: ['summary', 'startDateTime', 'endDateTime'],
        guestAllowed: false,
        example: 'Schedule a team sync tomorrow at 10am',
      },
      {
        name: 'createReminder',
        description: 'Create a one-off reminder task.',
        params: ['taskDescription'],
        guestAllowed: true,
        example: 'Remind me to drink water in 30 minutes',
      },
      {
        name: 'setReminder',
        description: 'Schedule a recurring reminder (cron).',
        params: ['reminderText', 'cronExpression'],
        guestAllowed: true,
        example: 'Recurring alarm every weekday at 8am',
      },
      {
        name: 'stopReminder',
        description: 'Cancel all of your scheduled reminders.',
        params: [],
        guestAllowed: true,
        example: 'Stop my active reminders',
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
        example: 'What do you remember about my projects?',
      },
      {
        name: 'memorize',
        description: 'Store an entry in long-term memory.',
        params: ['content', 'tags'],
        guestAllowed: false,
        example: 'Remember that I prefer concise answers',
      },
      {
        name: 'storeUserFact',
        description: 'Save a durable fact about you.',
        params: ['fact', 'category'],
        guestAllowed: false,
        example: 'Remember that my favorite city is Indore',
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
        example: 'Send an email to alex@example.com about the launch',
      },
      {
        name: 'sendWhatsAppMessage',
        description: 'Send a WhatsApp message.',
        params: ['recipientName', 'message'],
        guestAllowed: false,
        example: 'Send a WhatsApp message to Mom saying I will call later',
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
        example: 'What time is it right now?',
      },
      {
        name: 'getWeather',
        description: 'Get real-time weather for a location.',
        params: ['location'],
        guestAllowed: true,
        example: 'What is the weather in Ratlam today?',
      },
      {
        name: 'copyToClipboard',
        description: 'Copy text to the device clipboard.',
        params: ['text'],
        guestAllowed: true,
        example: 'Copy this to my clipboard: ARC-AI',
      },
      {
        name: 'executeCode',
        description: 'Run JavaScript in a sandbox.',
        params: ['code'],
        guestAllowed: false,
        example: 'Calculate 17% of 245000 precisely',
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
        example: 'Switch to hacker mode',
      },
    ],
  },
];

export const TOOL_COUNT = TOOL_CATALOG.reduce((n, c) => n + c.tools.length, 0);
