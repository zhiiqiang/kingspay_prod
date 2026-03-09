import { type ComponentType, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CreditCard,
  DollarSign,
  FileText,
  History,
  Landmark,
  LayoutDashboard,
  ListOrdered,
  LogIn,
  Package,
  ScrollText,
  SendHorizontal,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import {
  AccordionMenu,
  AccordionMenuClassNames,
  AccordionMenuGroup,
  AccordionMenuItem,
  AccordionMenuLabel,
} from '@/components/ui/accordion-menu';
import { getStoredUserPermissions } from '@/lib/auth';
import {
  getMenuSectionsForPermissions,
  menuSections,
  type MenuSection,
  type MenuSectionItem,
} from './menu-config';
import { useLanguage } from '@/i18n/language-provider';

export function SidebarSecondary() {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const [permissions] = useState(() => getStoredUserPermissions());
  const filteredMenuSections = useMemo(
    () => getMenuSectionsForPermissions(permissions),
    [permissions],
  );

  const getItemPaths = (items: MenuSectionItem[]): string[] =>
    items.flatMap((item) =>
      item.children ? getItemPaths(item.children) : item.path ? [item.path] : [],
    );

  const activeMenu =
    filteredMenuSections.reduce<MenuSection | null>((bestMatch, section) => {
      const matchingPath = getItemPaths(section.items).find(
        (path) => pathname === path || (path.length > 1 && pathname.startsWith(path)),
      );

      if (!matchingPath) return bestMatch;
      if (!bestMatch) return section;

      const bestMatchPath = getItemPaths(bestMatch.items).find(
        (path) => pathname === path || (path.length > 1 && pathname.startsWith(path)),
      );

      if (!bestMatchPath) return section;

      return matchingPath.length > bestMatchPath.length ? section : bestMatch;
    }, null) ||
    filteredMenuSections[0] ||
    menuSections[0];

  const classNames: AccordionMenuClassNames = {
    root: 'space-y-1',
    label:
      'uppercase text-xs font-medium text-muted-foreground/80 pt-6 mb-2 pb-0',
    group: 'space-y-2',
    item: '',
  };

  const selectedPath = getItemPaths(activeMenu.items).reduce((bestMatch, path) => {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return path.length > bestMatch.length ? path : bestMatch;
    }

    return bestMatch;
  }, '');

  const matchPath = (path: string) => path === selectedPath;

  const iconMap: Record<string, ComponentType<{ className?: string }>> = {
    'menu.dashboardOverview': LayoutDashboard,
    'menu.agent': Users,
    'menu.merchant': BriefcaseBusiness,
    'menu.operator': UserCog,
    'menu.channelItem': Wallet,
    'menu.channelProduct': Package,
    'menu.channelDisbursement': CreditCard,
    'menu.bankList': Landmark,
    'menu.payinTransaction': ScrollText,
    'menu.disbursementList': ScrollText,
    'menu.reconciliationList': FileText,
    'menu.merchantSummary': BarChart3,
    'menu.profit': DollarSign,
    'menu.profitList': ListOrdered,
    'menu.profitWithdraw': SendHorizontal,
    'menu.profitWithdrawHistory': History,
    'menu.exports': FileText,
    'menu.login': LogIn,
    'menu.channel': Wallet,
    'menu.merchantList': BriefcaseBusiness,
    'menu.operatorList': UserCog,
    'menu.admin': Building2,
  };

  const getMenuIcon = (item: MenuSectionItem) => {
    if (item.children?.length) return null;
    if (item.titleKey && iconMap[item.titleKey]) return iconMap[item.titleKey];
    return Wallet;
  };

  const renderMenuItems = (
    items: MenuSectionItem[],
    parentKey: string,
    depth = 0,
  ) =>
    items.map((item, itemIndex) => {
      if (item.children?.length) {
        const submenuValue = item.path ?? `${parentKey}-submenu-${itemIndex}`;
        const isCompactLabel =
          item.titleKey === 'menu.channelPayin' ||
          item.titleKey === 'menu.channelPayout' ||
          item.titleKey === 'menu.payin' ||
          item.titleKey === 'menu.payout';
        return (
          <div key={`${parentKey}-${itemIndex}`} className="space-y-1">
            <AccordionMenuLabel
              className={`pt-3 pb-1 ${depth > 0 ? 'pl-4' : 'pl-2'} ${
                isCompactLabel ? 'text-[10px]' : ''
              }`}
            >
              {item.titleKey ? t(item.titleKey) : item.title}
            </AccordionMenuLabel>
            <div className={`${depth > 0 ? 'pl-4' : 'pl-2'} space-y-1.5`}>
              {renderMenuItems(item.children, submenuValue, depth + 1)}
            </div>
          </div>
        );
      }

      return item.path ? (
        <AccordionMenuItem
          key={`${parentKey}-${itemIndex}`}
          value={item.path}
          className={depth > 0 ? 'pl-4' : 'pl-2'}
          asChild
        >
          <Link to={item.path}>
            <span className="flex items-center gap-2">
              {(() => {
                const Icon = getMenuIcon(item);
                return Icon ? (
                  <Icon className="size-4 shrink-0 text-current" />
                ) : null;
              })()}
              <span className="truncate">
                {item.titleKey ? t(item.titleKey) : item.title}
              </span>
            </span>
          </Link>
        </AccordionMenuItem>
      ) : (
        <AccordionMenuItem
          key={`${parentKey}-${itemIndex}`}
          value={`${parentKey}-item-${itemIndex}`}
          className={depth > 0 ? 'pl-4' : 'pl-2'}
        >
          {item.titleKey ? t(item.titleKey) : item.title}
        </AccordionMenuItem>
      );
    });

  return (
    <div className="grow shrink-0 ps-3.5 kt-scrollable-y-hover max-h-[calc(100vh-2rem)] pe-1 my-5">
      <AccordionMenu
        selectedValue={selectedPath || pathname}
        matchPath={matchPath}
        type="single"
        collapsible
        classNames={classNames}
      >
        <AccordionMenuGroup>
          <AccordionMenuLabel className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            {activeMenu.tooltipKey ? t(activeMenu.tooltipKey) : activeMenu.tooltip}
          </AccordionMenuLabel>
          {renderMenuItems(activeMenu.items, activeMenu.key)}
        </AccordionMenuGroup>
      </AccordionMenu>
    </div>
  );
}
