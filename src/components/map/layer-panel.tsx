import { Layers, X } from 'lucide-react'
import { useState } from 'react'
import { MapCheckbox } from '@/components/ui/checkbox'
import type { Catalog } from '@/data/map-data'
import { useMapUiStore } from '@/state/map-store'

// Layer panel: fully collapsible (collapsed by default on small screens; a floating button remains);
// grouped by the official label tree (top level = groups, leaves = selectable types); the first group starts open
export function LayerPanel({ catalog }: { catalog: Catalog }) {
  const selectedItemIds = useMapUiStore((s) => s.selectedItemIds)
  const toggleItem = useMapUiStore((s) => s.toggleItem)
  const [openGroup, setOpenGroup] = useState<number | null>(() => catalog.groups[0]?.id ?? null)
  // Open by default on desktop (>=768px), collapsed on small screens
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 768)

  const selected = new Set(selectedItemIds)

  if (!panelOpen) {
    return (
      <button
        type="button"
        aria-label="Show layer panel"
        className="absolute top-3 left-3 z-10 flex size-9 items-center justify-center rounded-lg border border-white/10 bg-neutral-900/90 text-neutral-200 backdrop-blur-sm hover:bg-neutral-800/90"
        onClick={() => setPanelOpen(true)}
      >
        <Layers className="size-4" />
      </button>
    )
  }

  return (
    <aside className="absolute top-3 left-3 z-10 flex max-h-[calc(100%-1.5rem)] w-60 max-w-[85vw] flex-col overflow-hidden rounded-lg border border-white/10 bg-neutral-900/90 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs font-semibold text-neutral-100">Layers</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-neutral-500">{selected.size} active</span>
          <button
            type="button"
            aria-label="Hide layer panel"
            className="flex size-5 items-center justify-center rounded text-neutral-400 hover:bg-white/10 hover:text-neutral-100"
            onClick={() => setPanelOpen(false)}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {catalog.groups.map((group) => {
          const groupSelected = group.items.filter((i) => selected.has(i.id)).length
          const isOpen = openGroup === group.id
          return (
            <div key={group.id} className="mb-1">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded px-1.5 py-1.5 text-left hover:bg-white/5"
                onClick={() => setOpenGroup(isOpen ? null : group.id)}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {/* Per-group selection dot: tells at a glance whether a collapsed group has active types */}
                  <span
                    className={
                      groupSelected > 0
                        ? 'size-1.5 shrink-0 rounded-full bg-sky-400'
                        : 'size-1.5 shrink-0 rounded-full bg-neutral-700'
                    }
                  />
                  <span className="truncate text-xs font-medium text-neutral-200">
                    {group.name}
                  </span>
                </span>
                <span
                  className={
                    groupSelected > 0
                      ? 'font-mono text-[10px] font-semibold text-sky-300'
                      : 'font-mono text-[10px] text-neutral-500'
                  }
                >
                  {groupSelected}/{group.items.length}
                </span>
              </button>
              {isOpen ? (
                <div className="mb-1 max-h-72 overflow-y-auto rounded bg-black/20 p-1">
                  {group.items.map((item) => (
                    <MapCheckbox
                      key={item.id}
                      checked={selected.has(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                      label={item.name}
                      count={item.count}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

// Whether to apply the default selection (nothing persisted yet)
export function isDefaultSelectionNeeded(selectedItemIds: number[]): boolean {
  return selectedItemIds.length === 0
}
