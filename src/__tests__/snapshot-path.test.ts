import { resolveSnapshotPath } from '@/data/official-data'

describe('resolveSnapshotPath', () => {
  test('prefixes snapshot-relative icon paths', () => {
    expect(resolveSnapshotPath('icons/abc.webp')).toBe('map-data/data/teyvat/icons/abc.webp')
  })

  test('prefixes snapshot-relative tile paths (v7.1.0 template format)', () => {
    expect(resolveSnapshotPath('tiles/23_8_N2.webp')).toBe(
      'map-data/data/teyvat/tiles/23_8_N2.webp',
    )
  })

  test('passes absolute paths through unchanged', () => {
    expect(resolveSnapshotPath('/anything/else.webp')).toBe('/anything/else.webp')
  })

  test('passes absolute CDN URLs through unchanged', () => {
    expect(resolveSnapshotPath('https://act-webstatic.mihoyo.com/x.webp')).toBe(
      'https://act-webstatic.mihoyo.com/x.webp',
    )
  })

  test('leaves other relative paths alone (no silent rewrites)', () => {
    expect(resolveSnapshotPath('something/else.json')).toBe('something/else.json')
  })
})
