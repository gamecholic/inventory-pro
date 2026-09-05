import { describe, expect, it } from 'vitest'
import { normalizeTR } from './normalizeTR'

describe('normalizeTR', () => {
  it('maps Turkish chars to Latin equivalents', () => {
    expect(normalizeTR('Çağdaş Şeker Ürün ÖĞÜT')).toBe('cagdas seker urun ogut')
  })

  it('treats dotted/dotless I variants equally', () => {
    expect(normalizeTR('IĞDIR')).toBe(normalizeTR('ığdır'))
    expect(normalizeTR('İZMİR')).toBe('izmir')
  })

  it('is case-insensitive for search use', () => {
    expect(normalizeTR('Süt')).toBe(normalizeTR('SUT'))
  })
})
