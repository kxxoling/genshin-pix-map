import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  type OfficialLabel,
  type OfficialPoint,
  resolveSnapshotPath,
  useOfficialLabels,
  useOfficialMeta,
  useOfficialPoints,
} from '@/data/official-data'
import { buildIconAtlas } from '@/render/icon-atlas'
import { createOfficialTileSource } from '@/render/official-tile-source'
import { gameToPixel, type OfficialMeta } from '@/render/official-tiles'
import type { MapMarker, TileSource } from '@/render/types'

export type CatalogItem = {
  id: number
  name: string
  icon: string
  count: number
}

export type CatalogGroup = {
  id: number
  name: string
  items: CatalogItem[]
}

export type Catalog = {
  meta: OfficialMeta
  source: TileSource
  groups: CatalogGroup[]
  points: OfficialPoint[]
}

// Catalog: meta + label tree (with counts) + raw points; all from the local snapshot, filtering derived client-side
export function useOfficialCatalog() {
  const meta = useOfficialMeta()
  const labels = useOfficialLabels()
  const points = useOfficialPoints()

  const isPending = meta.isPending || labels.isPending || points.isPending
  const error = meta.error ?? labels.error ?? points.error

  // Memoized: catalog.source is a renderer lifecycle dep and must keep a stable identity
  const data = useMemo(
    () =>
      meta.data && labels.data && points.data
        ? buildCatalog(meta.data, labels.data, points.data)
        : undefined,
    [meta.data, labels.data, points.data],
  )

  return { data, isPending, error }
}

function buildCatalog(
  meta: OfficialMeta,
  labels: OfficialLabel[],
  points: OfficialPoint[],
): Catalog {
  const countByLabel = new Map<number, number>()
  for (const p of points) {
    countByLabel.set(p.labelId, (countByLabel.get(p.labelId) ?? 0) + 1)
  }
  const groups: CatalogGroup[] = []
  for (const top of labels) {
    const items = (top.children ?? [])
      .map((leaf) => ({
        id: leaf.id,
        name: leaf.name,
        icon: leaf.icon,
        count: countByLabel.get(leaf.id) ?? 0,
      }))
      .filter((item) => item.count > 0)
    if (items.length > 0) {
      groups.push({ id: top.id, name: top.name, items })
    }
  }
  return { meta, source: createOfficialTileSource(meta), groups, points }
}

// Derive markers from the selected labels: filtering + conversion are sync; the icon atlas builds async (kind = atlas frame index)
export function useSelectedMarkers(catalog: Catalog | undefined, selectedLabelIds: number[]) {
  const key = useMemo(
    () => [...selectedLabelIds].sort((a, b) => a - b).join(','),
    [selectedLabelIds],
  )

  const atlasQuery = useQuery({
    queryKey: ['official', 'atlas', key],
    queryFn: async () => {
      if (!catalog) throw new Error('catalog not ready')
      const itemById = new Map(catalog.groups.flatMap((g) => g.items.map((i) => [i.id, i])))
      const icons = selectedLabelIds
        .map((id) => resolveSnapshotPath(itemById.get(id)?.icon ?? ''))
        .filter(Boolean)
      const iconUrls = [...new Set(icons)]
      const { atlas, kindByUrl } = await buildIconAtlas(iconUrls)
      const kindByLabel = new Map(
        selectedLabelIds.map((id) => {
          const icon = resolveSnapshotPath(itemById.get(id)?.icon ?? '')
          return [id, kindByUrl.get(icon) ?? 0]
        }),
      )
      return { atlas, kindByLabel }
    },
    enabled: catalog !== undefined && selectedLabelIds.length > 0,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    placeholderData: (prev) => prev,
  })

  const markers = useMemo<MapMarker[]>(() => {
    if (!catalog || !atlasQuery.data) return []
    const idSet = new Set(selectedLabelIds)
    const { kindByLabel } = atlasQuery.data
    return (
      catalog.points
        // z != 0 marks underground floors; only the surface renders until floor switching exists (else markers land in the sea)
        .filter((p) => idSet.has(p.labelId) && !p.z)
        .map((p) => {
          const pixel = gameToPixel(catalog.meta, p.x, p.y)
          return {
            id: `off-${p.id}`,
            kind: kindByLabel.get(p.labelId) ?? 0,
            x: pixel.x,
            y: pixel.y,
          }
        })
    )
  }, [catalog, selectedLabelIds, atlasQuery.data])

  return { markers, atlas: atlasQuery.data?.atlas }
}
