import { Fragment, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MENU_SIDEBAR } from '@/config/layout-4.config';
import { MenuItem } from '@/config/types';
import { cn } from '@/lib/utils';
import { useMenu } from '@/hooks/use-menu';
import { useLanguage } from '@/i18n/language-provider';

export interface ToolbarHeadingProps {
  title?: string | ReactNode;
  description?: string | ReactNode;
}

function Toolbar({ children }: { children?: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="container flex items-center justify-between flex-wrap gap-3">
        {children}
      </div>
    </div>
  );
}

function ToolbarActions({ children }: { children?: ReactNode }) {
  return <div className="flex items-center gap-2.5">{children}</div>;
}

function ToolbarBreadcrumbs() {
  const { pathname } = useLocation();
  const { getBreadcrumb, isActive } = useMenu(pathname);
  const { t } = useLanguage();
  const items: MenuItem[] = getBreadcrumb(MENU_SIDEBAR);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const active = item.path ? isActive(item.path) : false;

        return (
          <Fragment key={index}>
            {item.path ? (
              <Link
                to={item.path}
                className={cn(
                  'flex items-center gap-1',
                  active
                    ? 'text-mono'
                    : 'text-secondary-foreground hover:text-primary',
                )}
              >
                {item.titleKey ? t(item.titleKey) : item.title}
              </Link>
            ) : (
              <span
                className={cn(
                  isLast ? 'text-mono' : 'text-secondary-foreground',
                )}
              >
                {item.titleKey ? t(item.titleKey) : item.title}
              </span>
            )}
            {!isLast && <span className="text-secondary-foreground">/</span>}
          </Fragment>
        );
      })}
    </div>
  );
}

const ToolbarHeading = ({ title = '' }: ToolbarHeadingProps) => {
  const { pathname } = useLocation();
  const { getCurrentItem } = useMenu(pathname);
  const { t } = useLanguage();
  const item = getCurrentItem(MENU_SIDEBAR);

  return (
    <div className="flex items-center flex-wrap gap-1 lg:gap-5">
      <h1 className="font-medium text-lg text-mono">
        {title || (item?.titleKey ? t(item.titleKey) : item?.title)}
      </h1>
      <ToolbarBreadcrumbs />
    </div>
  );
};

export { Toolbar, ToolbarActions, ToolbarBreadcrumbs, ToolbarHeading };
