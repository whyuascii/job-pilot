export const theme = {
  colors: {
    sky: {
      light: '#e0f2fe',
      DEFAULT: '#0ea5e9',
      dark: '#0369a1',
    },
    panel: {
      light: '#f1f5f9',
      DEFAULT: '#64748b',
      dark: '#1e293b',
    },
    gauge: {
      DEFAULT: '#f59e0b',
      bright: '#fbbf24',
    },
    runway: {
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
    },
  },
  aviation: {
    status: {
      cleared: 'emerald',
      taxiing: 'sky',
      holding: 'amber',
      grounded: 'red',
      cruising: 'primary',
    },
    labels: {
      dashboard: 'Flight Deck',
      jobs: 'Flight Plan',
      applications: 'Flight Log',
      profile: 'Pilot Profile',
      settings: 'Ground Control',
      score: 'Altitude',
    },
  },
} as const;

export type Theme = typeof theme;
