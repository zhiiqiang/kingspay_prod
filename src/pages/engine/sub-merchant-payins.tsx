import { FeaturePage } from '@/pages/shared/feature-page';

export function EngineSubMerchantPayinsPage() {
  return (
    <FeaturePage
      title="Engine Sub-Merchant Pay-ins"
      items={[
        'Filter payin transactions by sub-merchant, channel, and timeframe.',
        'Download payin reports for reconciliation.',
        'Review transaction details to diagnose payment issues.',
      ]}
    />
  );
}
