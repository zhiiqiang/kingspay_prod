import { FeaturePage } from '@/pages/shared/feature-page';

export function ExportReportsPage() {
  return (
    <FeaturePage
      title="Exports and Reports"
      items={[
        'Export payin and payout histories for finance reconciliation.',
        'Generate profit and withdrawal summaries for revenue tracking.',
        'Deliver consistent CSV exports for both admin and engine users.',
      ]}
    />
  );
}
