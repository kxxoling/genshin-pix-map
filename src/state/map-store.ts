import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MapStats } from '@/render/map-renderer'

type MapUiState = {
  // Runtime mirrors (not persisted)
  stats: MapStats | null
  selectedMarkerId: string | null
  // Persisted: layer selection and collected checks
  selectedItemIds: number[]
  checkedMarkerIds: Record<string, true>
  setStats: (stats: MapStats) => void
  setSelectedMarker: (id: string | null) => void
  toggleItem: (itemId: number) => void
  toggleMarkerCheck: (markerId: string) => void
  setItemSelection: (ids: number[]) => void
}

// React-side mirror of map state; the render core is imperative, React subscribes to slices
// persist keeps only user state (selection/checks); runtime mirrors like stats stay in memory
export const useMapUiStore = create<MapUiState>()(
  persist(
    (set) => ({
      stats: null,
      selectedMarkerId: null,
      selectedItemIds: [],
      checkedMarkerIds: {},
      setStats: (stats) => set({ stats }),
      setSelectedMarker: (selectedMarkerId) => set({ selectedMarkerId }),
      toggleItem: (itemId) =>
        set((s) => ({
          selectedItemIds: s.selectedItemIds.includes(itemId)
            ? s.selectedItemIds.filter((id) => id !== itemId)
            : [...s.selectedItemIds, itemId],
        })),
      toggleMarkerCheck: (markerId) =>
        set((s) => {
          const next = { ...s.checkedMarkerIds }
          if (next[markerId]) {
            delete next[markerId]
          } else {
            next[markerId] = true
          }
          return { checkedMarkerIds: next }
        }),
      setItemSelection: (selectedItemIds) => set({ selectedItemIds }),
    }),
    {
      name: 'genshin-map-ui',
      partialize: (s) => ({
        selectedItemIds: s.selectedItemIds,
        checkedMarkerIds: s.checkedMarkerIds,
      }),
    },
  ),
)
