import { describe, it, expect } from 'vitest'
import { roughMetres, shouldSend, enqueue, drainBatch } from './shareTrack'
import type { Fix } from './types'

const fix = (lat: number, lon: number, ts: number): Fix => ({ lat, lon, ts, source: 'gps' })

describe('roughMetres', () => {
  it('is ~0 for the same point and grows with distance', () => {
    expect(roughMetres(fix(48, -4, 0), fix(48, -4, 0))).toBeCloseTo(0, 5)
    // ~0.001° latitude ≈ 111 m
    expect(roughMetres(fix(48, -4, 0), fix(48.001, -4, 0))).toBeGreaterThan(100)
    expect(roughMetres(fix(48, -4, 0), fix(48.001, -4, 0))).toBeLessThan(125)
  })
})

describe('shouldSend (cadence gate)', () => {
  const last = fix(48, -4, 1_000_000)
  it('always sends the first fix', () => {
    expect(shouldSend(null, fix(48, -4, 0), 0, 30_000)).toBe(true)
  })
  it('holds back inside the interval', () => {
    expect(shouldSend(last, fix(48, -4, last.ts + 5_000), last.ts + 5_000, 30_000)).toBe(false)
  })
  it('sends once moved enough after the interval', () => {
    const moved = fix(48.01, -4, last.ts + 40_000) // ~1 km
    expect(shouldSend(last, moved, last.ts + 40_000, 30_000)).toBe(true)
  })
  it('sends a keepalive when stationary past 4× the interval', () => {
    const same = fix(48, -4, last.ts + 130_000)
    expect(shouldSend(last, same, last.ts + 130_000, 30_000)).toBe(true)
  })
  it('holds back a stationary fix just after the interval', () => {
    const same = fix(48, -4, last.ts + 35_000)
    expect(shouldSend(last, same, last.ts + 35_000, 30_000)).toBe(false)
  })
  it('never sends a null fix', () => {
    expect(shouldSend(last, null, last.ts + 99_999, 30_000)).toBe(false)
  })
})

describe('enqueue (bounded ring buffer)', () => {
  it('appends and drops the oldest past the cap', () => {
    let buf: Fix[] = []
    for (let i = 0; i < 5; i++) buf = enqueue(buf, fix(48, -4, i), 3)
    expect(buf.map((f) => f.ts)).toEqual([2, 3, 4]) // kept the newest 3
  })
  it('does not mutate the input array', () => {
    const buf = [fix(48, -4, 1)]
    const next = enqueue(buf, fix(48, -4, 2), 10)
    expect(buf.length).toBe(1)
    expect(next.length).toBe(2)
  })
})

describe('drainBatch', () => {
  it('splits into a capped batch and the remainder', () => {
    const buf = Array.from({ length: 7 }, (_, i) => fix(48, -4, i))
    const { batch, rest } = drainBatch(buf, 3)
    expect(batch.map((f) => f.ts)).toEqual([0, 1, 2])
    expect(rest.map((f) => f.ts)).toEqual([3, 4, 5, 6])
  })
})
