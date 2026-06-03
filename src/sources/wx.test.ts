import { describe, it, expect } from 'vitest'
import {
  speedToBeaufort,
  degToPoint,
  addDaysYmd,
  pickHourIndex,
  parseGateWx,
  windAt,
  waveAt,
  gateTargetTime,
  liveWindForGate,
  liveWaveForGate,
  type WxSnapshot,
} from './wx'
import { windVerdict, VERDICT } from '../tide/windGate'
import { GATES } from '../data/gates'

describe('speedToBeaufort (knots → Beaufort)', () => {
  it('maps each band by its WMO upper bound', () => {
    const cases: [number, number][] = [
      [0, 0], [0.4, 0], [1, 1], [3, 1], [4, 2], [6, 2], [10, 3], [11, 4], [16, 4],
      [21, 5], [27, 6], [33, 7], [40, 8], [47, 9], [55, 10], [63, 11], [64, 12], [100, 12],
    ]
    for (const [kn, bft] of cases) expect(speedToBeaufort(kn)).toBe(bft)
  })
  it('guards junk input to calm', () => {
    expect(speedToBeaufort(-5)).toBe(0)
    expect(speedToBeaufort(NaN)).toBe(0)
  })
})

describe('degToPoint (degrees → 16-point compass)', () => {
  it('rounds to the nearest point, wrap-safe', () => {
    expect(degToPoint(0)).toBe('N')
    expect(degToPoint(360)).toBe('N')
    expect(degToPoint(11.24)).toBe('N')
    expect(degToPoint(11.26)).toBe('NNE')
    expect(degToPoint(90)).toBe('E')
    expect(degToPoint(180)).toBe('S')
    expect(degToPoint(225)).toBe('SW')
    expect(degToPoint(270)).toBe('W')
    expect(degToPoint(337.6)).toBe('NNW')
    expect(degToPoint(348.75)).toBe('N') // half-up rounds 15.5 → 16 → wraps to N
  })
})

describe('addDaysYmd', () => {
  it('adds days across month/year boundaries', () => {
    expect(addDaysYmd('2026-06-08', 0)).toBe('2026-06-08')
    expect(addDaysYmd('2026-06-08', 1)).toBe('2026-06-09')
    expect(addDaysYmd('2026-06-30', 1)).toBe('2026-07-01')
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('pickHourIndex', () => {
  const times = ['2026-06-08T09:00', '2026-06-08T10:00', '2026-06-08T11:00', '2026-06-09T10:00']
  it('picks the nearest hour on the target date', () => {
    expect(pickHourIndex(times, 642, '2026-06-08')).toBe(2) // 10:42 → 11:00
    expect(pickHourIndex(times, 600, '2026-06-08')).toBe(1) // 10:00 exact
  })
  it('respects the date, not just the clock (rollover guard)', () => {
    expect(pickHourIndex(times, 600, '2026-06-09')).toBe(3) // next day's 10:00, not same-clock today
  })
  it('returns -1 when the date is not covered', () => {
    expect(pickHourIndex(times, 600, '2026-06-20')).toBe(-1)
  })
})

describe('parseGateWx + windAt/waveAt', () => {
  const forecast = {
    hourly: {
      time: ['2026-06-08T10:00', '2026-06-08T11:00'],
      wind_speed_10m: [20, 25],
      wind_gusts_10m: [28, 34],
      wind_direction_10m: [220, 225],
    },
  }
  const marine = {
    hourly: {
      time: ['2026-06-08T10:00', '2026-06-08T11:00'],
      wave_height: [1.4, 1.8],
      wave_period: [6, 7],
      wave_direction: [250, 255],
    },
  }
  it('extracts index-aligned series and reads a given hour', () => {
    const wx = parseGateWx(forecast, marine, 1_000)
    expect(wx.fetchedTs).toBe(1_000)
    expect(windAt(wx, '2026-06-08', 660)).toEqual({ dirFromDeg: 225, kn: 25, gustKn: 34 })
    expect(waveAt(wx, '2026-06-08', 660)).toEqual({ m: 1.8, periodS: 7, dirFromDeg: 255 })
  })
  it('returns null for an uncovered hour and survives missing fields', () => {
    const wx = parseGateWx({ hourly: { time: ['2026-06-08T10:00'], wind_speed_10m: [12] } }, null, 1)
    expect(windAt(wx, '2026-06-08', 600)).toBeNull() // direction missing → no usable sample
    expect(waveAt(wx, '2026-06-08', 600)).toBeNull() // no marine data at all
  })
})

describe('gateTargetTime (recommended transit moment)', () => {
  it('uses the recommended HW turn for the Four on the brief example day', () => {
    // Mon 8 Jun: morning HW 11:12 → stream turn 10:42 = 642 min.
    expect(gateTargetTime('four', '2026-06-08')).toEqual({ ymd: '2026-06-08', minOfDay: 642 })
  })
  it('returns null outside the SHOM table', () => {
    expect(gateTargetTime('four', '2026-06-20')).toBeNull()
  })
})

describe('live forecast → gate go/no-go (the safety-critical seam)', () => {
  const snap: WxSnapshot = {
    offline: false,
    lastOkTs: 5_000,
    gates: {
      four: parseGateWx(
        {
          hourly: {
            time: ['2026-06-08T10:00', '2026-06-08T11:00'],
            wind_speed_10m: [24, 25],
            wind_gusts_10m: [30, 31],
            wind_direction_10m: [225, 225], // SW
          },
        },
        {
          hourly: {
            time: ['2026-06-08T10:00', '2026-06-08T11:00'],
            wave_height: [2.0, 2.3],
            wave_period: [8, 8],
            wave_direction: [240, 240],
          },
        },
        5_000,
      ),
      raz: null,
    },
  }

  it('a live SW ~25 kn forecast at the Four reproduces the existing SW-F6 NO-GO (no inversion)', () => {
    const live = liveWindForGate(snap, 'four', '2026-06-08')
    expect(live).not.toBeNull()
    expect(live!.dirFromDeg).toBe(225)
    expect(degToPoint(live!.dirFromDeg)).toBe('SW')
    expect(speedToBeaufort(live!.kn)).toBe(6)
    const r = windVerdict(GATES.four, { dir: degToPoint(live!.dirFromDeg), forceBft: speedToBeaufort(live!.kn) })
    expect(r.state).toBe(VERDICT.NOGO)
  })

  it('surfaces the sea state at the same transit hour', () => {
    const wave = liveWaveForGate(snap, 'four', '2026-06-08')
    expect(wave!.m).toBe(2.3) // nearest 11:00 to the 10:42 turn
    expect(wave!.targetYmd).toBe('2026-06-08')
  })

  it('returns null when the gate has no cached series', () => {
    expect(liveWindForGate(snap, 'raz', '2026-06-08')).toBeNull()
    expect(liveWindForGate(null, 'four', '2026-06-08')).toBeNull()
  })
})
