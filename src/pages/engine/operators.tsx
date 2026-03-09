import { FeaturePage } from '@/pages/shared/feature-page';

export function EngineOperatorsPage() {
  return (
    <FeaturePage
      title="Engine Operator Management"
      items={[
        'Add engine operators and define their responsibilities.',
        'Edit operator details to keep contact and permission data fresh.',
        'Configure access controls for payin, payout, and profit modules.',
      ]}
    />
  );
}
