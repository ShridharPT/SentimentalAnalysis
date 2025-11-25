import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EmotionDistributionProps {
  data?: Record<string, number>;
  loading: boolean;
}

const emotionEmojis: Record<string, string> = {
  joy: "😊",
  love: "❤️",
  surprise: "😮",
  sadness: "😢",
  anger: "😠",
  fear: "😨",
  neutral: "😐",
};

const EmotionDistribution = ({ data, loading }: EmotionDistributionProps) => {
  const emotions = data
    ? Object.entries(data)
        .map(([name, count]) => ({
          emoji: emotionEmojis[name.toLowerCase()] || "😐",
          name: name.charAt(0).toUpperCase() + name.slice(1),
          count,
        }))
        .sort((a, b) => b.count - a.count)
    : [];

  return (
    <Card className="shadow-medium border-border/50">
      <CardHeader>
        <CardTitle className="text-2xl font-display">Emotion Distribution</CardTitle>
        <CardDescription>Breakdown of detected emotions</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8 text-muted-foreground">Loading...</div>
        ) : emotions.length === 0 ? (
          <div className="flex justify-center py-8 text-muted-foreground">No emotion data available</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {emotions.map((emotion, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50 transition-smooth hover:shadow-medium hover:scale-[1.02]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{emotion.emoji}</span>
                  <span className="font-semibold text-foreground">{emotion.name}</span>
                </div>
                <Badge className="gradient-warm text-white text-base px-4 py-1">{emotion.count}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmotionDistribution;
