import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface EmotionalAnalysisProps {
  analysis: {
    emotion: string;
    emoji: string;
    confidence: number;
    allEmotions: Array<{ emotion: string; probability: number }>;
  } | null;
  hasContent: boolean;
}

const EmotionalAnalysis = ({ analysis, hasContent }: EmotionalAnalysisProps) => {
  return (
    <Card className="shadow-medium border-border/50 transition-smooth hover:shadow-large">
      <CardHeader>
        <CardTitle className="text-2xl font-display">Emotional Analysis</CardTitle>
        <CardDescription>AI-powered sentiment detection</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full gradient-warm opacity-20 mb-4"></div>
            <p className="text-muted-foreground text-lg">
              Write something to see emotional analysis
            </p>
          </div>
        ) : analysis ? (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center p-6 rounded-xl gradient-soft border border-border/50">
              <div className="text-6xl mb-3">{analysis.emoji}</div>
              <h3 className="text-2xl font-display font-semibold capitalize mb-2">
                {analysis.emotion}
              </h3>
              <p className="text-muted-foreground">
                Confidence: <span className="font-semibold text-foreground">{analysis.confidence}%</span>
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-base">All Detected Emotions:</h4>
              {analysis.allEmotions.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="capitalize font-medium">{item.emotion}</span>
                    <span className="text-muted-foreground">{Math.round(item.probability * 100)}%</span>
                  </div>
                  <Progress 
                    value={item.probability * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default EmotionalAnalysis;
