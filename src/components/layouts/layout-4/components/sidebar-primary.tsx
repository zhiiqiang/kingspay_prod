import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Globe, MoonStar, Settings, Sun, XCircle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getHeight } from '@/lib/dom';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { useViewport } from '@/hooks/use-viewport';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch, SwitchWrapper } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  clearStoredAuthToken,
  clearStoredUserPermissions,
  clearStoredUserRole,
  clearStoredUserName,
  getStoredUserPermissions,
  getStoredUserName,
} from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/i18n/language-provider';
import { LanguageSwitcher } from '@/components/language-switcher';
import {
  getMenuSectionsForPermissions,
  menuSections,
  type MenuSection,
  type MenuSectionItem,
} from './menu-config';

type SidebarPrimaryProps = {
  onLogout?: () => void;
};

type LogoutResponse = {
  status?: boolean;
  message?: string;
};

export function SidebarPrimary({ onLogout }: SidebarPrimaryProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [scrollableHeight, setScrollableHeight] = useState<number>(0);
  const [viewportHeight] = useViewport();
  const scrollableOffset = 80;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useLanguage();
  const [permissions] = useState(() => getStoredUserPermissions());
  const [userName] = useState(() => getStoredUserName());
  const avatarName = userName || t('user.fallbackName');
  const avatarUrl = `https://ui-avatars.com/api/?background=fc3f58&color=fff&name=${encodeURIComponent(
    avatarName,
  )}`;

  useEffect(() => {
    const headerHeight = headerRef.current ? getHeight(headerRef.current) : 0;
    const footerHeight = footerRef.current ? getHeight(footerRef.current) : 0;
    const availableHeight =
      viewportHeight - headerHeight - footerHeight - scrollableOffset;

    setScrollableHeight(availableHeight);
  }, [viewportHeight]);

  const filteredMenuSections = useMemo(
    () => getMenuSectionsForPermissions(permissions),
    [permissions],
  );
  const [selectedMenuItem, setSelectedMenuItem] = useState(
    () => filteredMenuSections[0] ?? menuSections[0],
  );

  useEffect(() => {
    setSelectedMenuItem((current) => {
      const match = filteredMenuSections.find(
        (section) => section.key === current?.key,
      );

      if (match) return match;

      return filteredMenuSections[0] ?? menuSections[0];
    });
  }, [filteredMenuSections]);

  useEffect(() => {
    const getItemPaths = (items: MenuSectionItem[]): string[] =>
      items.flatMap((item) =>
        item.children ? getItemPaths(item.children) : item.path ? [item.path] : [],
      );

    const match = filteredMenuSections.reduce<MenuSection | null>(
      (bestMatch, section) => {
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
      },
      null,
    );

    if (match && match.key !== selectedMenuItem?.key) {
      setSelectedMenuItem(match);
    }
  }, [filteredMenuSections, pathname, selectedMenuItem?.key]);

  const isDarkMode = resolvedTheme === 'dark';

  const handleLogout = async () => {
    try {
      const response = await apiFetch<LogoutResponse>('/auth/logout', {
        method: 'POST',
      });
      toast.success(response.message ?? t('logout.success'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('logout.error'), {
        duration: 1500,
        icon: <XCircle className="h-5 w-5 text-rose-500" />,
      });
    } finally {
      onLogout?.();
      clearStoredUserRole();
      clearStoredUserPermissions();
      clearStoredUserName();
      clearStoredAuthToken();
      navigate('/login', { replace: true });
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col items-stretch shrink-0 gap-5 py-5 w-[70px] border-e border-input">
        <div ref={headerRef} className="h-0" />

        <div className="flex grow shrink-0">
          <div
            className="kt-scrollable-y-hover grow gap-2.5 shrink-0 flex ps-4 flex-col"
            style={{ height: `${scrollableHeight}px` }}
          >
            <div className="flex items-center justify-center pe-4">
              <div className="flex size-12 rounded-full">
                <img
                  className="size-10"
                  src={toAbsoluteUrl(
                    isDarkMode
                      ? '/media/logo/mini-logo-circle-dark.svg'
                      : '/media/logo/mini-logo-circle.svg',
                  )}
                  alt="Kingspay"
                />
              </div>
            </div>
            {filteredMenuSections.map((item, index) => (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="ghost"
                    mode="icon"
                    {...(item === selectedMenuItem
                      ? { 'data-state': 'open' }
                      : {})}
                    className={cn(
                      'shrink-0 rounded-md size-9 border border-transparent text-[color:var(--sidebar-foreground)]',
                      'data-[state=open]:bg-[color:var(--color-primary)/12%] data-[state=open]:border-[color:var(--color-primary)] data-[state=open]:text-[color:var(--color-primary)] data-[state=open]:shadow-[0_0_0_1px_color:var(--color-primary)]',
                      'hover:bg-[color:var(--sidebar-hover-bg)] hover:border-[color:var(--sidebar-hover-border)] hover:text-[color:var(--sidebar-hover-text)]',
                    )}
                  >
                    <Link to={item.defaultPath}>
                      <item.icon className="size-4.5!" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {item.tooltipKey ? t(item.tooltipKey) : item.tooltip}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        <div
          ref={footerRef}
          className="flex flex-col gap-4 items-center shrink-0 ps-2"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                mode="icon"
                className="size-9 rounded-full border border-border p-0"
              >
                <img
                  className="size-9 rounded-full"
                  src={avatarUrl}
                  alt="User Avatar"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-3">
              <div className="flex items-center gap-3">
                <img
                  className="size-10 rounded-full border border-border"
                  src={avatarUrl}
                  alt="User Avatar"
                />
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {userName || t('user.fallbackName')}
                  </div>
                </div>
              </div>
              <DropdownMenuSeparator className="my-3" />
              <div className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground">
                <Globe className="size-4 text-muted-foreground" />
                <span className="flex-1">{t('language.label')}</span>
                <LanguageSwitcher
                  size="sm"
                  showLabel={false}
                  className="w-[140px] bg-background"
                />
              </div>
              <DropdownMenuSeparator className="my-3" />
              <DropdownMenuItem asChild>
                <Link to="/profile/account-settings">
                  <Settings className="size-4" />
                  <span>{t('user.accountSettings')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-3" />
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={(event) => {
                  event.preventDefault();
                }}
              >
                {isDarkMode ? (
                  <Sun className="size-4" />
                ) : (
                  <MoonStar className="size-4" />
                )}
                <span>{t('theme.darkMode')}</span>
                <SwitchWrapper className="ms-auto">
                  <Switch
                    checked={isDarkMode}
                    onCheckedChange={() => setTheme(isDarkMode ? 'light' : 'dark')}
                  />
                </SwitchWrapper>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-3" />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  void handleLogout();
                }}
              >
                {t('action.logout')}
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  );
}
