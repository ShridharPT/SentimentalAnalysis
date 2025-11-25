import { useState, useEffect, useRef } from "react";
import { Send, RefreshCw, Loader2, Mic, MicOff } from "lucide-react";
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

// Extend Window interface for SpeechRecognition
interface IWindow extends Window {
  SpeechRecognition: any;
  webkitSpeechRecognition: any;
}

const WriteEntry = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Check for speech recognition support
  useEffect(() => {
    const windowWithSpeech = window as unknown as IWindow;
    const SpeechRecognition = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setContent((prev) => prev + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          setError("Microphone access denied. Please allow microphone access.");
        }
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          // Restart if still supposed to be listening
          try {
            recognitionRef.current.start();
          } catch (e) {
            setIsListening(false);
          }
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening]);

  // Fetch latest entry on mount and show analysis if created within 1 minute
  useEffect(() => {
    const fetchLatestEntry = async () => {
      try {
        const entries = await entriesAPI.getAll();
        if (entries.length > 0) {
          const latestEntry = entries[0];
          const createdAt = new Date(latestEntry.created_at);
          const now = new Date();
          const diffMs = now.getTime() - createdAt.getTime();
          const diffMinutes = diffMs / (1000 * 60);

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

  const toggleListening = () => {
    if (!speechSupported) {
      setError("Speech recognition is not supported in your browser. Try Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setError("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Error starting speech recognition:", e);
        setError("Failed to start voice input. Please try again.");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    // Stop listening when submitting
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    try {
      const entry = await entriesAPI.create(title || "Untitled", content);

      setSuccess("Entry saved successfully!");
      setTimeout(() => setSuccess(""), 3000);

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
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
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
              <div className="flex items-center justify-between">
                <Label htmlFor="content" className="text-base font-medium">
                  What's on your mind?
                </Label>
                <Button
                  type="button"
                  variant={isListening ? "destructive" : "outline"}
                  size="sm"
                  onClick={toggleListening}
                  className={`gap-2 ${isListening ? "animate-pulse" : ""}`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      Voice Input
                    </>
                  )}
                </Button>
              </div>
              {isListening && (
                <p className="text-sm text-primary animate-pulse">🎤 Listening... Speak now</p>
              )}
              <Textarea
                id="content"
                placeholder="Write your thoughts, feelings, and experiences... or click Voice Input to speak"
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
