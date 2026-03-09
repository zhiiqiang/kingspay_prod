import { FeaturePage } from '@/pages/shared/feature-page';

export function EngineSubMerchantPayoutsPage() {
  return (
    <FeaturePage
      title="Engine Sub-Merchant Payouts"
      items={[
        'Filter payouts by date range, status, and merchant.',
        'Download payout reports for finance reconciliation.',
        'Inspect payout details to resolve settlement blockers.',
      ]}
    />
  );
}
