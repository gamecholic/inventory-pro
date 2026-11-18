import { describe, expect, it } from 'vitest'
import { isIosSafari, isStandalone } from './pwa'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const IPADOS_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const MACOS_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const IOS_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

describe('isIosSafari', () => {
  it('detects iPhone Safari', () => {
    expect(isIosSafari(IPHONE_SAFARI, 'iPhone', 5)).toBe(true)
  })

  it('detects iPadOS Safari behind the desktop Mac user agent', () => {
    expect(isIosSafari(IPADOS_SAFARI, 'MacIntel', 5)).toBe(true)
  })

  it('ignores desktop Safari', () => {
    expect(isIosSafari(MACOS_SAFARI, 'MacIntel', 0)).toBe(false)
  })

  it('ignores other iOS browsers', () => {
    expect(isIosSafari(IOS_CHROME, 'iPhone', 5)).toBe(false)
  })

  it('ignores Android Chrome', () => {
    expect(isIosSafari(ANDROID_CHROME, 'Linux armv8l', 5)).toBe(false)
  })
})

describe('isStandalone', () => {
  it('is true when the display mode is standalone', () => {
    expect(isStandalone(true)).toBe(true)
  })

  it('is true when iOS reports navigator.standalone', () => {
    expect(isStandalone(false, true)).toBe(true)
  })

  it('is false in a normal Safari tab', () => {
    expect(isStandalone(false, false)).toBe(false)
  })
})
