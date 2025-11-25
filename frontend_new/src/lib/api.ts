// API utility for communicating with Flask backend
const API_BASE = '/api';

export interface DiaryEntry {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  primary_emotion: string;
  emotion_confidence: number;
  sentiment_score: number;
  emotion_probabilities: Record<string, number>;
  mood_category: string;
}

export interface AnalyticsData {
  total_entries: number;
  mood_distribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  emotion_distribution: Record<string, number>;
  average_sentiment: number;
  daily_breakdown: Record<string, any>;
  period: string;
}

// Entries API
export const entriesAPI = {
  getAll: async (): Promise<DiaryEntry[]> => {
    const response = await fetch(`${API_BASE}/entries`);
    if (!response.ok) throw new Error('Failed to fetch entries');
    return response.json();
  },

  getById: async (id: number): Promise<DiaryEntry> => {
    const response = await fetch(`${API_BASE}/entries/${id}`);
    if (!response.ok) throw new Error('Failed to fetch entry');
    return response.json();
  },

  create: async (title: string, content: string): Promise<DiaryEntry> => {
    const response = await fetch(`${API_BASE}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create entry');
    }
    const data = await response.json();
    return data.entry;
  },

  update: async (id: number, title?: string, content?: string): Promise<DiaryEntry> => {
    const response = await fetch(`${API_BASE}/entries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update entry');
    }
    const data = await response.json();
    return data.entry;
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE}/entries/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete entry');
  },

  deleteAll: async (): Promise<void> => {
    const response = await fetch(`${API_BASE}/entries/all`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete all entries');
  },
};

// Analytics API
export const analyticsAPI = {
  getDashboard: async (period: 'week' | 'month' | 'all' = 'week', date?: string): Promise<AnalyticsData> => {
    const params = new URLSearchParams({ period });
    if (date) params.append('date', date);
    const response = await fetch(`${API_BASE}/analytics/dashboard?${params}`);
    if (!response.ok) throw new Error('Failed to fetch dashboard analytics');
    return response.json();
  },

  getTrends: async (period: 'week' | 'month' = 'week'): Promise<Record<string, any>> => {
    const response = await fetch(`${API_BASE}/analytics/trends?period=${period}`);
    if (!response.ok) throw new Error('Failed to fetch trends');
    return response.json();
  },
};

// Health check
export const healthAPI = {
  check: async () => {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  },
};
