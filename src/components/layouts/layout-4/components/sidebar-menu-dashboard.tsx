import { useCallback, useMemo } from 'react';
import {
  Badge,
  ChevronDown,
  FileText,
  Settings,
  SquareCode,
  UserCircle,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  AccordionMenu,
  AccordionMenuClassNames,
  AccordionMenuGroup,
  AccordionMenuItem,
  AccordionMenuLabel,
} from '@/components/ui/accordion-menu';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/i18n/language-provider';

interface DropdownItem {
  title: string;
  titleKey?: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
}

interface MenuItem {
  title: string;
  titleKey?: string;
  path?: string;
  active?: boolean;
}

interface MenuLabel {
  label: string;
  labelKey?: string;
}

type MenuNode = MenuItem | MenuLabel;

export function SidebarMenuDashboard() {
  const { pathname } = useLocation();
  const { t } = useLanguage();

  const dropdownItems: DropdownItem[] = [
    {
      title: 'Client API',
      titleKey: 'sidebar.dashboard.clientApi',
      path: '#',
      icon: SquareCode,
      active: true,
    },
    {
      title: 'Profile',
      titleKey: 'sidebar.dashboard.profile',
      path: '#',
      icon: UserCircle,
    },
    {
      title: 'My Account',
      titleKey: 'sidebar.dashboard.myAccount',
      path: '#',
      icon: Settings,
    },
    {
      title: 'Projects',
      titleKey: 'sidebar.dashboard.projects',
      path: '#',
      icon: FileText,
    },
    {
      title: 'Personal info',
      titleKey: 'sidebar.dashboard.personalInfo',
      path: '#',
      icon: Badge,
    },
  ];

  const currentDropdownItem = dropdownItems[0];

  const menuItems = useMemo<MenuNode[]>(
    () => [
      { label: 'Configuration', labelKey: 'sidebar.dashboard.configuration' },
      { title: 'API Setup', titleKey: 'sidebar.dashboard.apiSetup', path: '#' },
      { title: 'Team Settings', titleKey: 'sidebar.dashboard.teamSettings', path: '#' },
      { title: 'Authentication', titleKey: 'sidebar.dashboard.authentication', path: '#' },
      { title: 'Endpoints Configs', titleKey: 'sidebar.dashboard.endpointsConfigs', path: '#' },
      { title: 'Rate Limiting', titleKey: 'sidebar.dashboard.rateLimiting', path: '#' },
      { label: 'Security', labelKey: 'sidebar.dashboard.security' },
      { title: 'Data Encryption', titleKey: 'sidebar.dashboard.dataEncryption', path: '#' },
      { title: 'Text', titleKey: 'sidebar.dashboard.text', path: '#' },
      { title: 'Access Control', titleKey: 'sidebar.dashboard.accessControl', path: '#' },
      { label: 'Analytics', labelKey: 'sidebar.dashboard.analytics' },
      {
        title: 'Incident Response',
        titleKey: 'sidebar.dashboard.incidentResponse',
        path: '#',
      },
      { title: 'Fetching Data', titleKey: 'sidebar.dashboard.fetchingData', path: '#' },
      { title: 'Custom Reports', titleKey: 'sidebar.dashboard.customReports', path: '#' },
      {
        title: 'Real Time Analytics',
        titleKey: 'sidebar.dashboard.realTimeAnalytics',
        path: '#',
      },
      { title: 'Exporting Data', titleKey: 'sidebar.dashboard.exportingData', path: '#' },
      { title: 'Dashboard Integration', titleKey: 'sidebar.dashboard.dashboardIntegration', path: '#' },
    ],
    [],
  );

  const classNames: AccordionMenuClassNames = {
    root: 'space-y-1',
    label:
      'uppercase text-xs font-medium text-muted-foreground/80 pt-6 mb-2 pb-0',
    item: 'h-8 hover:bg-background border-accent text-accent-foreground hover:text-primary data-[selected=true]:text-primary data-[selected=true]:bg-background data-[selected=true]:font-medium',
  };

  const matchPath = useCallback(
    (path: string): boolean =>
      path === pathname || (path.length > 1 && pathname.startsWith(path)),
    [pathname],
  );

  const buildDropdown = () => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            mode="input"
            className="w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <currentDropdownItem.icon />
              {currentDropdownItem.titleKey ? t(currentDropdownItem.titleKey) : currentDropdownItem.title}
            </span>
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
          {dropdownItems.map((item, index) => (
            <DropdownMenuItem key={index} asChild>
              <Link to={item.path}>
                <item.icon />
                <span>{item.titleKey ? t(item.titleKey) : item.title}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const buildMenu = () => {
    return (
      <AccordionMenu
        selectedValue={'#dashbaord'}
        matchPath={matchPath}
        type="single"
        collapsible
        classNames={classNames}
      >
        <AccordionMenuGroup>
          {menuItems.map((item, index) =>
            'label' in item ? (
              <AccordionMenuLabel key={index}>
                {item.labelKey ? t(item.labelKey) : item.label}
              </AccordionMenuLabel>
            ) : (
              <AccordionMenuItem
                key={index}
                value={item.path || `item-${index}`}
                className="text-sm"
              >
                <Link to={item.path || '#'}>{item.titleKey ? t(item.titleKey) : item.title}</Link>
              </AccordionMenuItem>
            ),
          )}
        </AccordionMenuGroup>
      </AccordionMenu>
    );
  };

  return (
    <div className="w-full space-y-1">
      {buildDropdown()}
      {buildMenu()}
    </div>
  );
}
