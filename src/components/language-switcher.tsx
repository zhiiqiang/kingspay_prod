import { useId } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useLanguage } from '@/i18n/language-provider';
import { SupportedLocale } from '@/i18n/messages';
import { cn } from '@/lib/utils';

type LanguageSwitcherProps = {
  className?: string;
  labelClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
};

export function LanguageSwitcher({
  className,
  labelClassName,
  size = 'md',
  showLabel = true,
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useLanguage();
  const labelId = useId();
  const optionMeta: Record<SupportedLocale, { labelKey: string; icon: string }> = {
    en: { labelKey: 'language.english', icon: '🇺🇸' },
    id: { labelKey: 'language.indonesian', icon: '🇮🇩' },
  };
  const selectedOption = optionMeta[locale];

  return (
    <div className="space-y-2">
      {showLabel && (
        <label
          htmlFor={labelId}
          className={labelClassName ?? 'text-xs font-semibold text-muted-foreground'}
        >
          {t('language.label')}
        </label>
      )}
      <Select value={locale} onValueChange={(value) => setLocale(value as SupportedLocale)}>
        <SelectTrigger
          id={labelId}
          size={size}
          className={cn('w-full bg-background px-3', className)}
          aria-label={t('language.label')}
        >
          <span className="flex items-center gap-2.5 sm:gap-3.5">
            <span className='mr-2' aria-hidden="true">{selectedOption.icon}</span>
            <span className="hidden sm:inline">{t(selectedOption.labelKey)}</span>
          </span>
        </SelectTrigger>
        <SelectContent className="min-w-[4.5rem] sm:min-w-[8rem]">
          <SelectItem value="en">
            <span className="flex items-center gap-2.5">
              <span aria-hidden="true">{optionMeta.en.icon}</span>
              <span className="hidden sm:inline">{t(optionMeta.en.labelKey)}</span>
            </span>
          </SelectItem>
          <SelectItem value="id">
            <span className="flex items-center gap-2.5">
              <span aria-hidden="true">{optionMeta.id.icon}</span>
              <span className="hidden sm:inline">{t(optionMeta.id.labelKey)}</span>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
