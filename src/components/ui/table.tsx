'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div data-slot="table-wrapper" className="relative w-full overflow-auto max-sm:overflow-visible">
      <table
        data-slot="table"
        className={cn(
          'w-full caption-bottom text-foreground text-sm max-sm:block max-sm:!min-w-0 max-sm:!w-full',
          className,
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b max-sm:hidden', className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('sm:[&_tr:last-child]:border-0 max-sm:block max-sm:space-y-4', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t bg-muted/50 font-medium last:[&>tr]:border-b-0', className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b transition-colors [&:has(td):hover]:bg-muted/50 data-[state=selected]:bg-muted max-sm:block max-sm:rounded-lg max-sm:border max-sm:border-border max-sm:bg-card max-sm:p-4 max-sm:shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-12 px-4 text-left rtl:text-right align-middle font-normal text-muted-foreground [&:has([role=checkbox])]:pe-0',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-4 align-middle [&:has([role=checkbox])]:pe-0 max-sm:grid max-sm:min-w-0 max-sm:grid-cols-[minmax(0,45%)_minmax(0,55%)] max-sm:items-start max-sm:gap-3 max-sm:break-words max-sm:whitespace-normal max-sm:px-0 max-sm:py-2 max-sm:text-left max-sm:text-xs max-[480px]:text-[10px] max-sm:before:min-w-0 max-sm:before:w-full max-sm:before:break-words max-sm:before:whitespace-normal max-sm:before:text-left max-sm:before:justify-self-start max-sm:before:text-xs max-[480px]:before:text-[10px] max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)] max-sm:[&:not([data-label])]:before:content-none max-sm:[&:not([data-label])]:grid-cols-1 max-sm:[&:not([data-label])]:justify-center max-sm:[&:not([data-label])]:items-center max-sm:[&:not([data-label])]:text-center",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption data-slot="table-caption" className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
  );
}

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
