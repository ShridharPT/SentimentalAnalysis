import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, X } from "lucide-react";
import MoodDistribution from "@/components/MoodDistribution";
import EmotionDistribution from "@/components/EmotionDistribution";
import { analyticsAPI, AnalyticsData } from "@/lib/api";

const Dashboard = () => {
  const [period, setPeriod] = useState<"week" | "month" | "all">("week");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const dateStr = selectedDate
          ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
          : undefined;
        const analytics = await analyticsAPI.getDashboard(period, dateStr);
        setData(analytics);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period, selectedDate]);

  // Calculate top emotion from emotion_distribution
  const getTopEmotion = () => {
    if (!data?.emotion_distribution) return "-";
    const entries = Object.entries(data.emotion_distribution);
    if (entries.length === 0) return "-";
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return sorted[0][0].charAt(0).toUpperCase() + sorted[0][0].slice(1);
  };

  const formatSelectedDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
  };

  const clearDateFilter = () => {
    setSelectedDate(undefined);
  };

  return (
    <div className="space-y-6">
      {/* Period Selector and Date Filter */}
      <div className="flex flex-wrap items-center gap-4">
        <Tabs
          value={period}
          onValueChange={(v) => setPeriod(v as "week" | "month" | "all")}
          className={selectedDate ? "opacity-50 pointer-events-none" : ""}
        >
          <TabsList className="bg-card shadow-soft border border-border/50 p-1.5 h-auto">
            <TabsTrigger
              value="week"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-smooth px-6 py-2.5"
            >
              This Week
            </TabsTrigger>
            <TabsTrigger
              value="month"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-smooth px-6 py-2.5"
            >
              This Month
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-smooth px-6 py-2.5"
            >
              All Time
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
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
                onSelect={handleDateSelect}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {selectedDate && (
            <Button variant="ghost" size="sm" onClick={clearDateFilter} className="px-2">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-medium border-border/50 transition-smooth hover:shadow-large bg-white">
          <CardHeader className="pb-3">
            <CardDescription className="text-gray-600">Total Entries</CardDescription>
          </CardHeader>
          <CardContent className="bg-white">
            <div className="text-5xl font-display font-bold text-gray-900">
              {loading ? "..." : data?.total_entries ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-medium border-border/50 transition-smooth hover:shadow-large bg-white">
          <CardHeader className="pb-3">
            <CardDescription className="text-gray-600">Avg Sentiment</CardDescription>
          </CardHeader>
          <CardContent className="bg-white">
            <div className="text-5xl font-display font-bold text-gray-900">
              {loading ? "..." : data?.average_sentiment?.toFixed(2) ?? "0.00"}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-medium border-border/50 transition-smooth hover:shadow-large bg-white">
          <CardHeader className="pb-3">
            <CardDescription className="text-gray-600">Most Common Emotion</CardDescription>
          </CardHeader>
          <CardContent className="bg-white">
            <div className="text-5xl font-display font-bold text-gray-900">{loading ? "..." : getTopEmotion()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Mood Distribution */}
      <MoodDistribution data={data?.mood_distribution} totalEntries={data?.total_entries ?? 0} loading={loading} />

      {/* Emotion Distribution */}
      <EmotionDistribution data={data?.emotion_distribution} loading={loading} />
    </div>
  );
};

export default Dashboard;
