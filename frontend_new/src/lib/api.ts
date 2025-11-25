// API utility for communicating with Flask backend
const API_BASE = "/api";

function getAuthHeader(): HeadersInit {
  const token = localStorage.getItem("moodmate-token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface DiaryEntry {
  id: string;
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
  period: string;
}

// Entries API
export const entriesAPI = {
  getAll: async (): Promise<DiaryEntry[]> => {
    const response = await fetch(`${API_BASE}/entries`, {
      headers: { ...getAuthHeader() },
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error("Unauthorized");
      throw new Error("Failed to fetch entries");
    }
    return response.json();
  },

  getById: async (id: string): Promise<DiaryEntry> => {
    const response = await fetch(`${API_BASE}/entries/${id}`, {
      headers: { ...getAuthHeader() },
    });
    if (!response.ok) throw new Error("Failed to fetch entry");
    return response.json();
  },

  create: async (title: string, content: string): Promise<DiaryEntry> => {
    const response = await fetch(`${API_BASE}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ title, content }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create entry");
    }
    const data = await response.json();
    return data.entry;
  },

  update: async (id: string, title?: string, content?: string): Promise<DiaryEntry> => {
    const response = await fetch(`${API_BASE}/entries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ title, content }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update entry");
    }
    const data = await response.json();
    return data.entry;
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/entries/${id}`, {
      method: "DELETE",
      headers: { ...getAuthHeader() },
    });
    if (!response.ok) throw new Error("Failed to delete entry");
  },

  deleteAll: async (): Promise<void> => {
    const response = await fetch(`${API_BASE}/entries/all`, {
      method: "DELETE",
      headers: { ...getAuthHeader() },
    });
    if (!response.ok) throw new Error("Failed to delete all entries");
  },
};

// Analytics API
export const analyticsAPI = {
  getDashboard: async (period: "week" | "month" | "all" = "week", date?: string): Promise<AnalyticsData> => {
    const params = new URLSearchParams({ period });
    if (date) params.append("date", date);
    const response = await fetch(`${API_BASE}/analytics/dashboard?${params}`, {
      headers: { ...getAuthHeader() },
    });
    if (!response.ok) throw new Error("Failed to fetch dashboard analytics");
    return response.json();
  },
};

// Health check
export const healthAPI = {
  check: async () => {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) throw new Error("Health check failed");
    return response.json();
  },
};
