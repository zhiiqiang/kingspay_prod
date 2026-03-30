import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Layout4 } from '@/components/layouts/layout-4';
import { AdminDashboardPage } from '@/pages/admin/dashboard';
import { AdminOperatorPage } from '@/pages/admin/operators';
import { AdminPayinPage } from '@/pages/admin/payin';
import { AdminDisbursementPage } from '@/pages/admin/disbursement';
import { AdminAgentPage } from '@/pages/admin/agents';
import { AdminEngineListPage } from '@/pages/admin/engine-list';
import { AdminChannelPage } from '@/pages/admin/channel';
import { AdminChannelProdukPage } from '@/pages/admin/channel-produk';
import { AdminChannelStorePage } from '@/pages/admin/channel-store';
import { AdminChannelDisbursementPage } from '@/pages/admin/channel-disbursement';
import { AdminBankListPage } from '@/pages/admin/bank-list';
import { AdminProfitPage } from '@/pages/admin/profit';
import { ReconciliationListPage } from '@/pages/reconciliation/reconciliation-list';
import { MerchantSummaryReportPage } from '@/pages/reports/merchant-summary';
import { LoginPage } from '@/pages/auth/login';
import { TwoFaSetupPage } from '@/pages/auth/two-fa-setup';
import { AccountSettingsPage } from '@/pages/profile/account-settings';
import { getStoredUserPermissions } from '@/lib/auth';
import { AccessDeniedPage } from '@/pages/shared/access-denied';
import { NotFoundPage } from '@/pages/shared/not-found';

type RequirePermissionProps = {
  permission?: string;
  children: ReactNode;
};

const RequirePermission = ({ permission, children }: RequirePermissionProps) => {
  if (!permission) return <>{children}</>;

  const permissions = getStoredUserPermissions();
  if (permissions.includes(permission)) return <>{children}</>;

  return <AccessDeniedPage />;
};

export function AppRoutingSetup() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/two-fa-setup" element={<TwoFaSetupPage />} />

      <Route element={<Layout4 />}>
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route
          path="/admin/operators"
          element={
            <RequirePermission permission="operator:list">
              <AdminOperatorPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/payin"
          element={
            <RequirePermission permission="payin:list">
              <AdminPayinPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/disbursement"
          element={
            <RequirePermission permission="disbursement:list">
              <AdminDisbursementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/merchant"
          element={
            <RequirePermission permission="merchant:list">
              <AdminEngineListPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/agents"
          element={
            <RequirePermission permission="user:list">
              <AdminAgentPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/channel"
          element={
            <RequirePermission permission="channel:list">
              <AdminChannelPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/channel-produk"
          element={
            <RequirePermission permission="channelProduk:list">
              <AdminChannelProdukPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/channel-store"
          element={
            <RequirePermission permission="channelStore:list">
              <AdminChannelStorePage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/channel-disbursement"
          element={
            <RequirePermission permission="channelDisbursement:list">
              <AdminChannelDisbursementPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/bank-list"
          element={
            <RequirePermission permission="bankList:list">
              <AdminBankListPage />
            </RequirePermission>
          }
        />
        <Route path="/admin/profit" element={<Navigate to="/admin/profit/list" replace />} />
        <Route path="/admin/profit/list" element={<AdminProfitPage tab="list" />} />
        <Route path="/admin/profit/withdraw" element={<AdminProfitPage tab="withdraw" />} />
        <Route path="/admin/profit/history" element={<AdminProfitPage tab="history" />} />
        <Route path="/admin/*" element={<NotFoundPage />} />
        <Route
          path="/reconciliation/list"
          element={
            <RequirePermission permission="recon:list">
              <ReconciliationListPage />
            </RequirePermission>
          }
        />
        <Route path="/reconciliation/*" element={<NotFoundPage />} />        <Route
          path="/reports/merchant-summary"
          element={
            <RequirePermission permission="report:merchant-summary">
              <MerchantSummaryReportPage />
            </RequirePermission>
          }
        />
        <Route path="/reports/*" element={<NotFoundPage />} />        <Route path="/profile/account-settings" element={<AccountSettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage fullScreen />} />
    </Routes>
  );
}
