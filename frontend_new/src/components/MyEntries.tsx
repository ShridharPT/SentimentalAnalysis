import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Trash2, CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { entriesAPI, DiaryEntry } from "@/lib/api";

const emotionEmojis: Record<string, string> = {
  joy: "😊",
  love: "❤️",
  surprise: "😮",
  sadness: "😢",
  anger: "😠",
  fear: "😨",
  neutral: "😐",
};

const MyEntries = () => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await entriesAPI.getAll();
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entries");
      console.error("Error fetching entries:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter entries by selected date
  const filteredEntries = useMemo(() => {
    if (!selectedDate) return entries;
    return entries.filter((entry) => {
      const entryDate = new Date(entry.created_at);
      return (
        entryDate.getFullYear() === selectedDate.getFullYear() &&
        entryDate.getMonth() === selectedDate.getMonth() &&
        entryDate.getDate() === selectedDate.getDate()
      );
    });
  }, [entries, selectedDate]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    try {
      await entriesAPI.delete(id);
      setEntries(entries.filter((e) => e.id !== id));
      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete entry");
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Are you sure you want to delete ALL entries? This cannot be undone!")) return;
    try {
      setDeleting(true);
      await entriesAPI.deleteAll();
      setEntries([]);
      setSelectedEntry(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete all entries");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSelectedDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Entries List */}
      <Card className="shadow-medium border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-display">Recent Entries</CardTitle>
              <CardDescription>Your emotional journey</CardDescription>
            </div>
            {entries.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAll}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete All
              </Button>
            )}
          </div>
          {/* Date Filter */}
          <div className="flex items-center gap-2 mt-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? formatSelectedDate(selectedDate) : "Filter by date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {selectedDate && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)} className="px-2">
                <X className="h-4 w-4" />
              </Button>
            )}
            {selectedDate && (
              <span className="text-sm text-muted-foreground">
                {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[550px] pr-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading entries...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/20 mb-4"></div>
                <p className="text-destructive text-lg">{error}</p>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full gradient-warm opacity-20 mb-4"></div>
                <p className="text-muted-foreground text-lg">
                  {selectedDate ? "No entries for this date" : "No entries yet. Start writing!"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="w-full text-left p-4 rounded-xl border-2 border-border/50 hover:border-primary/50 bg-card transition-smooth hover:shadow-medium group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-smooth">
                        {entry.title}
                      </h3>
                      <span className="text-2xl">{emotionEmojis[entry.primary_emotion] || "😐"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{formatDate(entry.created_at)}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{entry.content}</p>
                    <Badge className="gradient-warm text-white capitalize">
                      {emotionEmojis[entry.primary_emotion] || "😐"} {entry.primary_emotion}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Entry Details */}
      <Card className="shadow-medium border-border/50">
        <CardHeader>
          <CardTitle className="text-2xl font-display">Entry Details</CardTitle>
          <CardDescription>View your selected entry</CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedEntry ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full gradient-warm opacity-20 mb-4"></div>
              <p className="text-muted-foreground text-lg">Select an entry to view details</p>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              <div className="p-6 rounded-xl gradient-soft border border-border/50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-display font-semibold mb-1">{selectedEntry.title}</h3>
                    <p className="text-sm text-muted-foreground">{formatDate(selectedEntry.created_at)}</p>
                  </div>
                  <span className="text-4xl">{emotionEmojis[selectedEntry.primary_emotion] || "😐"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge className="gradient-warm text-white capitalize">
                    {emotionEmojis[selectedEntry.primary_emotion] || "😐"} {selectedEntry.primary_emotion}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(selectedEntry.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-base">Content:</h4>
                <p className="text-muted-foreground leading-relaxed">{selectedEntry.content}</p>
              </div>

              {selectedEntry.emotion_probabilities && Object.keys(selectedEntry.emotion_probabilities).length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-base">Emotion Breakdown:</h4>
                  <div className="space-y-2">
                    {Object.entries(selectedEntry.emotion_probabilities).map(([emotion, prob]) => (
                      <div key={emotion} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground capitalize">{emotion}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full gradient-warm" style={{ width: `${(prob as number) * 100}%` }} />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">
                            {Math.round((prob as number) * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyEntries;
