import { FeaturePage } from '@/pages/shared/feature-page';

export function EngineDisbursementPage() {
  return (
    <FeaturePage
      title="Engine Disbursement"
      items={[
        'Trigger disbursements programmatically for sub-merchants.',
        'Monitor disbursement status and investigate errors.',
        'Align disbursement rules with engine-level balances.',
      ]}
    />
  );
}
