import { Outlet } from 'react-router-dom';
import { useBodyClass } from '@/hooks/use-body-class';
import { useIsMobile } from '@/hooks/use-mobile';
import { Footer } from './footer';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { Toolbar, ToolbarHeading } from './toolbar';

export function Main() {
  const isMobileMode = useIsMobile();

  // Using the custom hook to set multiple CSS variables and class properties
  useBodyClass(`
    [--header-height:60px]
    [--sidebar-width:290px]
    bg-muted!
  `);

  return (
    <div className="flex grow w-full min-w-0 max-w-full">
      {isMobileMode && <Header />}

      <div className="flex flex-col lg:flex-row grow w-full min-w-0 max-w-full pt-(--header-height) lg:pt-0 px-5 max-sm:px-3 lg:px-0">
        {!isMobileMode && <Sidebar />}

        <div className="flex grow min-w-0 w-full max-w-full rounded-xl bg-background border border-input lg:ms-(--sidebar-width) mt-0 lg:mt-5">
          <div className="flex flex-col grow min-w-0 w-full max-w-full kt-scrollable-y-auto lg:[--kt-scrollbar-width:auto] p-5 max-sm:p-3">
            <main className="grow min-w-0" role="content">
              <Toolbar>
                <ToolbarHeading />
              </Toolbar>
              <Outlet />
            </main>

            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}
