import { useState, useEffect } from "react";
import { Send, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import EmotionalAnalysis from "@/components/EmotionalAnalysis";
import { entriesAPI } from "@/lib/api";

const emotionEmojis: Record<string, string> = {
  joy: "😊",
  love: "❤️",
  surprise: "😮",
  sadness: "😢",
  anger: "😠",
  fear: "😨",
  neutral: "😐",
};

const WriteEntry = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch latest entry on mount and show analysis if created within 1 minute
  useEffect(() => {
    const fetchLatestEntry = async () => {
      try {
        const entries = await entriesAPI.getAll();
        if (entries.length > 0) {
          const latestEntry = entries[0]; // Already sorted by created_at desc
          const createdAt = new Date(latestEntry.created_at);
          const now = new Date();
          const diffMs = now.getTime() - createdAt.getTime();
          const diffMinutes = diffMs / (1000 * 60);

          // Show analysis if entry was created within 1 minute
          if (diffMinutes <= 1 && latestEntry.primary_emotion) {
            setAnalysis({
              emotion: latestEntry.primary_emotion,
              emoji: emotionEmojis[latestEntry.primary_emotion] || "😐",
              confidence: Math.round((latestEntry.emotion_confidence || 0) * 100),
              allEmotions: Object.entries(latestEntry.emotion_probabilities || {}).map(([emotion, probability]) => ({
                emotion,
                probability: (probability as number) * 100,
              })),
              sentimentScore: latestEntry.sentiment_score,
              moodCategory: latestEntry.mood_category,
            });
          }
        }
      } catch (err) {
        console.error("Error fetching latest entry:", err);
      }
    };

    fetchLatestEntry();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const entry = await entriesAPI.create(title || "Untitled", content);
      
      setSuccess("Entry saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      
      // Set analysis from the response
      setAnalysis({
        emotion: entry.primary_emotion,
        emoji: emotionEmojis[entry.primary_emotion] || "😐",
        confidence: Math.round((entry.emotion_confidence || 0) * 100),
        allEmotions: Object.entries(entry.emotion_probabilities || {}).map(([emotion, probability]) => ({
          emotion,
          probability: (probability as number) * 100,
        })),
        sentimentScore: entry.sentiment_score,
        moodCategory: entry.mood_category,
      });

      // Clear form
      setTitle("");
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
      console.error("Error saving entry:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setTitle("");
    setContent("");
    setAnalysis(null);
    setError("");
    setSuccess("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Write Entry Form */}
      <Card className="shadow-medium border-border/50 transition-smooth hover:shadow-large">
        <CardHeader>
          <CardTitle className="text-2xl font-display">Write Your Diary Entry</CardTitle>
          <CardDescription>Express your thoughts and feelings freely</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="mb-4 bg-primary/10 text-primary border-primary/20">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base font-medium">
                Title (Optional)
              </Label>
              <Input
                id="title"
                placeholder="Give your entry a title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-2 focus:border-primary transition-smooth"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content" className="text-base font-medium">
                What's on your mind?
              </Label>
              <Textarea
                id="content"
                placeholder="Write your thoughts, feelings, and experiences..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                className="min-h-[240px] border-2 focus:border-primary transition-smooth resize-none"
              />
            </div>

            <div className="flex gap-3">
              <Button 
                type="submit" 
                disabled={loading || !content.trim()}
                className="flex-1 gradient-warm text-white shadow-medium hover:shadow-large transition-smooth h-12 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Save Entry
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClear}
                className="px-6 border-2 hover:bg-muted transition-smooth h-12"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Emotional Analysis */}
      <EmotionalAnalysis analysis={analysis} hasContent={content.length > 0} />
    </div>
  );
};

export default WriteEntry;
