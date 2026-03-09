import { FeaturePage } from '@/pages/shared/feature-page';

export function EngineProfitListPage() {
  return (
    <FeaturePage
      title="Engine Profit List"
      items={[
        'Filter profit statements by merchant and date range.',
        'Download profit summaries for accounting review.',
        'Monitor profit contributions to identify top-performing sub-merchants.',
      ]}
    />
  );
}
