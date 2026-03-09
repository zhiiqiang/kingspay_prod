import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { SidebarPrimary } from './sidebar-primary';
import { SidebarSecondary } from './sidebar-secondary';

export function Header() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { pathname } = useLocation();

  // Close sheet when route changes
  useEffect(() => {
    setIsSheetOpen(false);
  }, [pathname]);

  return (
    <header className="flex lg:hidden items-center fixed z-10 top-0 start-0 end-0 shrink-0 bg-[var(--page-bg)] dark:bg-[var(--page-bg-dark)] h-[var(--header-height)]">
      <div className="container flex items-center justify-between flex-wrap gap-3">
        <div className="flex-1" />

        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" mode="icon" className="-ms-2 lg:hidden">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent
            className="p-0 gap-0 w-[var(--sidebar-width)]"
            side="left"
            close={false}
          >
            <SheetHeader className="p-0 space-y-0">
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
            </SheetHeader>
            <SheetBody className="p-0 flex items-stretch shrink-0 overflow-y-auto">
              <SidebarPrimary onLogout={() => setIsSheetOpen(false)} />
              <SidebarSecondary />
            </SheetBody>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
