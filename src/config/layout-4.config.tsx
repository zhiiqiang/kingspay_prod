import { BarChart3, ClipboardList, DollarSign, FileText, ShieldCheck, UserCircle } from 'lucide-react';
import { type MenuConfig } from './types';

export const MENU_SIDEBAR: MenuConfig = [
  {
    title: 'Admin',
    titleKey: 'menu.admin',
    icon: ShieldCheck,
    children: [
      {
        title: 'Dashboard Overview',
        titleKey: 'menu.dashboardOverview',
        path: '/admin/dashboard',
      },
      { title: 'Agent', titleKey: 'menu.agent', path: '/admin/agents' },
      { title: 'Merchant', titleKey: 'menu.merchant', path: '/admin/merchant' },
      { title: 'Operator', titleKey: 'menu.operator', path: '/admin/operators' },
    ],
  },
  {
    title: 'Channel',
    titleKey: 'menu.channel',
    icon: ShieldCheck,
    children: [
      {
        title: 'Channel Payin',
        titleKey: 'menu.channelPayin',
        children: [
          { title: 'Channel', titleKey: 'menu.channelItem', path: '/admin/channel' },
          {
            title: 'Channel Product',
            titleKey: 'menu.channelProduct',
            path: '/admin/channel-produk',
          },
          {
            title: 'Channel Store',
            titleKey: 'menu.channelStore',
            path: '/admin/channel-store',
          },
        ],
      },
      {
        title: 'Channel Payout',
        titleKey: 'menu.channelPayout',
        children: [
          {
            title: 'Channel Disbursement',
            titleKey: 'menu.channelDisbursement',
            path: '/admin/channel-disbursement',
          },
          { title: 'Bank List', titleKey: 'menu.bankList', path: '/admin/bank-list' },
        ],
      },
      {
        title: 'PAYIN',
        titleKey: 'menu.payin',
        children: [
          {
            title: 'Payin Transaction',
            titleKey: 'menu.payinTransaction',
            path: '/admin/payin',
          },
        ],
      },
      {
        title: 'PAYOUT',
        titleKey: 'menu.payout',
        children: [
          {
            title: 'Disbursement',
            titleKey: 'menu.disbursementList',
            path: '/admin/disbursement',
          },
        ],
      },
    ],
  },
  {
    title: 'Profit',
    titleKey: 'menu.profit',
    icon: DollarSign,
    children: [
      { title: 'Profit List', titleKey: 'menu.profitList', path: '/admin/profit/list' },
      { title: 'Withdraw', titleKey: 'menu.profitWithdraw', path: '/admin/profit/withdraw' },
      { title: 'Withdraw History', titleKey: 'menu.profitWithdrawHistory', path: '/admin/profit/history' },
    ],
  },
  {
    title: 'Reconciliation',
    titleKey: 'menu.reconciliation',
    icon: ClipboardList,
    children: [
      {
        title: 'Reconciliation List',
        titleKey: 'menu.reconciliationList',
        path: '/reconciliation/list',
      },
    ],
  },
  {
    title: 'Reports',
    titleKey: 'menu.reports',
    icon: BarChart3,
    children: [{ title: 'Exports', titleKey: 'menu.exports', path: '/reports/export' }],
  },
  {
    title: 'Access',
    titleKey: 'menu.access',
    icon: FileText,
    children: [{ title: 'Login', titleKey: 'menu.login', path: '/login' }],
  },
  {
    title: 'Profile',
    titleKey: 'menu.profile',
    icon: UserCircle,
    children: [
      {
        title: 'Account setting',
        titleKey: 'menu.accountSettings',
        path: '/profile/account-settings',
      },
    ],
  },
];
