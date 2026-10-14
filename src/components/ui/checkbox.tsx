import { Checkbox } from '@base-ui/react/checkbox'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

// shadcn-style Checkbox wrapper (Base UI, render-prop composition)
type MapCheckboxProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  count?: number
  className?: string
}

export function MapCheckbox({
  checked,
  onCheckedChange,
  label,
  count,
  className,
}: MapCheckboxProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Base UI Checkbox.Root renders a hidden input inside this label
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-white/5',
        className,
      )}
    >
      <Checkbox.Root
        checked={checked}
        onCheckedChange={(value: boolean) => onCheckedChange(value)}
        render={(props: ComponentPropsWithoutRef<'span'>) => (
          <span
            {...props}
            className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none transition-colors',
              checked
                ? 'border-sky-400 bg-sky-500 text-white'
                : 'border-neutral-500 bg-transparent',
            )}
          >
            {checked ? '✓' : null}
          </span>
        )}
      />
      <span className="min-w-0 flex-1 truncate text-xs text-neutral-200">{label}</span>
      {count !== undefined ? (
        <span className="font-mono text-[10px] text-neutral-500">{count}</span>
      ) : null}
    </label>
  )
}
