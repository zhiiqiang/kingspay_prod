import { FeaturePage } from '@/pages/shared/feature-page';

export function EngineProfitWithdrawalPage() {
  return (
    <FeaturePage
      title="Engine Profit Withdrawal"
      items={[
        'Filter withdrawal requests by merchant, sub-merchant, and status.',
        'Download withdrawal records for reconciliation.',
        'Track balances to ensure available funds before release.',
      ]}
    />
  );
}
