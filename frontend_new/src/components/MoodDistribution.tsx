import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface MoodDistributionProps {
  data?: {
    positive: number;
    neutral: number;
    negative: number;
  };
  totalEntries: number;
  loading: boolean;
}

const MoodDistribution = ({ data, totalEntries, loading }: MoodDistributionProps) => {
  const getPercentage = (count: number) => {
    if (!totalEntries || totalEntries === 0) return 0;
    return Math.round((count / totalEntries) * 100);
  };

  const moodData = {
    positive: { count: data?.positive ?? 0, percentage: getPercentage(data?.positive ?? 0) },
    neutral: { count: data?.neutral ?? 0, percentage: getPercentage(data?.neutral ?? 0) },
    negative: { count: data?.negative ?? 0, percentage: getPercentage(data?.negative ?? 0) },
  };

  const MoodCircle = ({
    percentage,
    count,
    label,
    color,
  }: {
    percentage: number;
    count: number;
    label: string;
    color: string;
  }) => (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${percentage * 2.51327} 251.327`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-display font-bold text-gray-900">{percentage}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="font-semibold text-gray-900 capitalize">{label}</p>
        <p className="text-sm text-gray-600">({count})</p>
      </div>
    </div>
  );

  return (
    <Card className="shadow-medium border-border/50">
      <CardHeader>
        <CardTitle className="text-2xl font-display">Mood Distribution</CardTitle>
        <CardDescription>Your emotional balance over time</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8 text-gray-500">Loading...</div>
        ) : (
          <div className="flex flex-wrap justify-center gap-12 py-8">
            <MoodCircle
              percentage={moodData.positive.percentage}
              count={moodData.positive.count}
              label="Positive"
              color="hsl(142 70% 45%)"
            />
            <MoodCircle
              percentage={moodData.neutral.percentage}
              count={moodData.neutral.count}
              label="Neutral"
              color="hsl(42 85% 65%)"
            />
            <MoodCircle
              percentage={moodData.negative.percentage}
              count={moodData.negative.count}
              label="Negative"
              color="hsl(0 84% 60%)"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MoodDistribution;
