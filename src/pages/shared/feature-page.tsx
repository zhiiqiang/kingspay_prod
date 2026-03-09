import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface FeaturePageProps {
  title: string;
  items?: string[];
}

export function FeaturePage({ title, items }: FeaturePageProps) {
  return (
    <div className="container space-y-6 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">{title}</h1>
      </div>

      <Separator />

      {items && (
        <Card>
          <CardHeader className="text-lg font-medium">Core capabilities</CardHeader>
          <CardContent className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1 block size-1.5 rounded-full bg-primary" aria-hidden="true" />
                <p className="leading-relaxed">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
