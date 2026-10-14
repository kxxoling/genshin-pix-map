import { cn } from '@/lib/utils'

describe('cn helper', () => {
  test('merges classes with later ones winning', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  test('skips falsy values', () => {
    expect(cn('text-sm', false && 'text-lg', undefined, 'font-bold')).toBe('text-sm font-bold')
  })
})
