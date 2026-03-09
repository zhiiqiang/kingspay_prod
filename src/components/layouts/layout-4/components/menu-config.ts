import React from 'react';
import { BarChart3, ClipboardList, DollarSign, ShieldCheck, Wallet } from 'lucide-react';

export interface MenuSectionItem {
  title: string;
  titleKey?: string;
  path?: string;
  permission?: string;
  children?: MenuSectionItem[];
}

export interface MenuSection {
  key: 'admin' | 'channel' | 'profit' | 'reconciliation' | 'reports';
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
  tooltipKey?: string;
  rootPath: string;
  defaultPath: string;
  items: MenuSectionItem[];
}

export const menuSections: MenuSection[] = [
  {
    key: 'admin',
    icon: ShieldCheck,
    tooltip: 'Admin menus',
    tooltipKey: 'menu.tooltip.admin',
    rootPath: '/admin',
    defaultPath: '/admin/dashboard',
    items: [
      {
        title: 'Dashboard Overview',
        titleKey: 'menu.dashboardOverview',
        path: '/admin/dashboard',
      },
      {
        title: 'Agent',
        titleKey: 'menu.agent',
        path: '/admin/agents',
        permission: 'user:list',
      },
      {
        title: 'Merchant',
        titleKey: 'menu.merchant',
        path: '/admin/merchant',
        permission: 'merchant:list',
      },
      {
        title: 'Operator',
        titleKey: 'menu.operator',
        path: '/admin/operators',
        permission: 'operator:list',
      },
    ],
  },
  {
    key: 'channel',
    icon: Wallet,
    tooltip: 'Channel menus',
    tooltipKey: 'menu.tooltip.channel',
    rootPath: '/admin',
    defaultPath: '/admin/channel',
    items: [
      {
        title: 'Channel Payin',
        titleKey: 'menu.channelPayin',
        children: [
          {
            title: 'Channel',
            titleKey: 'menu.channelItem',
            path: '/admin/channel',
            permission: 'channel:list',
          },
          {
            title: 'Channel Product',
            titleKey: 'menu.channelProduct',
            path: '/admin/channel-produk',
            permission: 'channelProduk:list',
          },
          {
            title: 'Channel Store',
            titleKey: 'menu.channelStore',
            path: '/admin/channel-store',
            permission: 'channelStore:list',
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
            permission: 'channelDisbursement:list',
          },
          {
            title: 'Bank List',
            titleKey: 'menu.bankList',
            path: '/admin/bank-list',
            permission: 'bankList:list',
          },
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
            permission: 'payin:list',
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
            permission: 'disbursement:list',
          },
        ],
      },
    ],
  },
  {
    key: 'profit',
    icon: DollarSign,
    tooltip: 'Profit menus',
    tooltipKey: 'menu.tooltip.profit',
    rootPath: '/admin/profit',
    defaultPath: '/admin/profit/list',
    items: [
      {
        title: 'Profit List',
        titleKey: 'menu.profitList',
        path: '/admin/profit/list',
      },
      {
        title: 'Withdraw',
        titleKey: 'menu.profitWithdraw',
        path: '/admin/profit/withdraw',
      },
      {
        title: 'Withdraw History',
        titleKey: 'menu.profitWithdrawHistory',
        path: '/admin/profit/history',
      },
    ],
  },
  {
    key: 'reconciliation',
    icon: ClipboardList,
    tooltip: 'Reconciliation menus',
    tooltipKey: 'menu.tooltip.reconciliation',
    rootPath: '/reconciliation',
    defaultPath: '/reconciliation/list',
    items: [
      {
        title: 'Reconciliation List',
        titleKey: 'menu.reconciliationList',
        path: '/reconciliation/list',
        permission: 'recon:list',
      },
    ],
  },
  {
    key: 'reports',
    icon: BarChart3,
    tooltip: 'Reports menus',
    tooltipKey: 'menu.tooltip.reports',
    rootPath: '/reports',
    defaultPath: '/reports/merchant-summary',
    items: [
      {
        title: 'Merchant Summary',
        titleKey: 'menu.merchantSummary',
        path: '/reports/merchant-summary',
        permission: 'report:merchant-summary',
      },
    ],
  },
];

export const getMenuSectionsForPermissions = (permissions: string[]) => {
  const permissionSet = new Set(permissions);

  const filterMenuItems = (items: MenuSectionItem[]): MenuSectionItem[] =>
    items.reduce<MenuSectionItem[]>((filtered, item) => {
      if (item.permission && !permissionSet.has(item.permission)) {
        return filtered;
      }

      if (item.children) {
        const filteredChildren = filterMenuItems(item.children);
        if (filteredChildren.length === 0) return filtered;
        filtered.push({ ...item, children: filteredChildren });
        return filtered;
      }

      filtered.push(item);
      return filtered;
    }, []);

  const getItemPaths = (items: MenuSectionItem[]): string[] =>
    items.flatMap((item) =>
      item.children ? getItemPaths(item.children) : item.path ? [item.path] : [],
    );

  return menuSections
    .map((section) => {
      const filteredItems = filterMenuItems(section.items);

      const availablePaths = getItemPaths(filteredItems);
      if (availablePaths.length === 0) return null;

      const defaultPath =
        availablePaths.find((path) => path === section.defaultPath) ?? availablePaths[0];

      return {
        ...section,
        defaultPath,
        items: filteredItems,
      };
    })
    .filter((section): section is MenuSection => section !== null);
};
