import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/utils/number-format';
import { useLanguage } from '@/i18n/language-provider';
import { ApiAuthError, apiFetch } from '@/lib/api';
import { toast } from 'sonner';


export function AdminDashboardPage() {
  const { t } = useLanguage();
  const [summaryToday, setSummaryToday] = useState<
    | {
      totalTransaksi?: number;
      totalAmount?: number;
      totalBiayaChannel?: number;
      totalBiayaAgent?: number;
      totalProfit?: number;
    }
    | null
  >(null);
  const [summaryYesterday, setSummaryYesterday] = useState<typeof summaryToday>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoadingSummary(true);
    void apiFetch<{ status: boolean; message?: string; data?: { summaryToday?: any; summaryYesterday?: any } }>(
      '/transaction/summary',
    )
      .then((res) => {
        if (!mounted) return;
        setSummaryToday(res.data?.summaryToday ?? null);
        setSummaryYesterday(res.data?.summaryYesterday ?? null);
      })
      .catch((err) => {
        if (err instanceof ApiAuthError) {
          toast.error(t('auth.sessionExpired'));
        } else {
          toast.error(err instanceof Error ? err.message : t('dashboard.toast.loadError'));
        }
      })
      .finally(() => {
        if (mounted) setIsLoadingSummary(false);
      });

    return () => {
      mounted = false;
    };
  }, [t]);
  

  return (
    <div className="container space-y-8 pb-10 pt-4">
      <h1 className="text-3xl font-semibold leading-tight">{t('dashboard.pageTitle')}</h1>

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t('dashboard.summary.yesterdayTitle')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
            <Card>
              <CardHeader className="border-0 px-4 pt-4 pb-2">
                <CardDescription className="w-full">{t('dashboard.summary.totalTransaksi')}</CardDescription>
                <CardTitle className="w-full text-2xl">{isLoadingSummary ? <Skeleton className="h-6 w-20" /> : (summaryYesterday?.totalTransaksi ?? '-')}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0" />
            </Card>

            <Card>
              <CardHeader className="border-0 px-4 pt-4 pb-2">
                <CardDescription className="w-full">{t('dashboard.summary.totalAmount')}</CardDescription>
                <CardTitle className="w-full text-2xl">{isLoadingSummary ? <Skeleton className="h-6 w-24" /> : (summaryYesterday?.totalAmount ? formatCurrency(summaryYesterday.totalAmount) : '-')}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0" />
            </Card>

            <Card>
              <CardHeader className="border-0 px-4 pt-4 pb-2">
                <CardDescription className="w-full">{t('dashboard.summary.totalBiayaChannel')}</CardDescription>
                <CardTitle className="w-full text-2xl">{isLoadingSummary ? <Skeleton className="h-6 w-24" /> : (summaryYesterday?.totalBiayaChannel ? formatCurrency(summaryYesterday.totalBiayaChannel) : '-')}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0" />
            </Card>

            <Card>
              <CardHeader className="border-0 px-4 pt-4 pb-2">
                <CardDescription className="w-full">{t('dashboard.summary.totalBiayaAgent')}</CardDescription>
                <CardTitle className="w-full text-2xl">{isLoadingSummary ? <Skeleton className="h-6 w-24" /> : (summaryYesterday?.totalBiayaAgent ? formatCurrency(summaryYesterday.totalBiayaAgent) : '-')}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0" />
            </Card>

            <Card>
              <CardHeader className="border-0 px-4 pt-4 pb-2">
                <CardDescription className="w-full">{t('dashboard.summary.totalProfit')}</CardDescription>
                <CardTitle className="w-full text-2xl">{isLoadingSummary ? <Skeleton className="h-6 w-24" /> : (summaryYesterday?.totalProfit ? formatCurrency(summaryYesterday.totalProfit) : '-')}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0" />
            </Card>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t('dashboard.summary.todayTitle')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
            <Card>
              <CardHeader className="border-0 px-4 pt-4 pb-2">
                <CardDescription className="w-full">{t('dashboard.summary.totalTransaksi')}</CardDescription>
                <CardTitle className="w-full text-2xl">{isLoadingSummary ? <Skeleton className="h-6 w-20" /> : (summaryToday?.totalTransaksi ?? '-')}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0" />
            </Card>

            <Card>
              <CardHeader className="border-0 px-4 pt-4 pb-2">
                <CardDescription className="w-full">{t('dashboard.summary.totalAmount')}</CardDescription>
                <CardTitle className="w-full text-2xl">{isLoadingSummary ? <Skeleton className="h-6 w-24" /> : (summaryToday?.totalAmount ? formatCurrency(summaryToday.totalAmount) : '-')}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0" />
            </Card>

            <Card>
              <CardHeader className="border-0 px-4 pt-4 pb-2">
                <CardDescription className="w-full">{t('dashboard.summary.totalBiayaChannel')}</CardDescription>
                <CardTitle className="w-full text-2xl">{isLoadingSummary ? <Skeleton className="h-6 w-24" /> : (summaryToday?.totalBiayaChannel ? formatCurrency(summaryToday.totalBiayaChannel) : '-')}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0" />
            </Card>

            <Card>
              <CardHeader className="border-0 px-4 pt-4 pb-2">
                <CardDescription className="w-full">{t('dashboard.summary.totalBiayaAgent')}</CardDescription>
                <CardTitle className="w-full text-2xl">{isLoadingSummary ? <Skeleton className="h-6 w-24" /> : (summaryToday?.totalBiayaAgent ? formatCurrency(summaryToday.totalBiayaAgent) : '-')}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0" />
            </Card>

            <Card>
              <CardHeader className="border-0 px-4 pt-4 pb-2">
                <CardDescription className="w-full">{t('dashboard.summary.totalProfit')}</CardDescription>
                <CardTitle className="w-full text-2xl">{isLoadingSummary ? <Skeleton className="h-6 w-24" /> : (summaryToday?.totalProfit ? formatCurrency(summaryToday.totalProfit) : '-')}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0" />
            </Card>
          </div>
        </section>
      </div>

    </div>
  );
}
