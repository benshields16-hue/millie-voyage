import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidFix, normaliseFix, fixesFromBody, trimTrail } from './trail.mjs'
import { safeEqual, bearerToken } from './auth.mjs'

test('isValidFix rejects malformed/out-of-range input', () => {
  assert.equal(isValidFix({ lat: 48, lon: -4, ts: 1 }), true)
  assert.equal(isValidFix({ lat: 91, lon: -4, ts: 1 }), false)
  assert.equal(isValidFix({ lat: 48, lon: -200, ts: 1 }), false)
  assert.equal(isValidFix({ lat: 48, lon: -4 }), false) // missing ts
  assert.equal(isValidFix({ lat: 'x', lon: -4, ts: 1 }), false)
  assert.equal(isValidFix(null), false)
})

test('normaliseFix keeps known fields, maps heading/accuracy/source, drops junk', () => {
  const n = normaliseFix({ lat: 48, lon: -4, ts: 9, sog: 5, cog: 200, heading: 210, accuracy: 12, source: 'gps', junk: 1 })
  assert.deepEqual(n, { ts: 9, lat: 48, lon: -4, sog: 5, cog: 200, hdg: 210, acc: 12, src: 'gps' })
  assert.equal('junk' in n, false)
})

test('fixesFromBody handles a single fix, a batch, and caps batch size', () => {
  assert.equal(fixesFromBody({ lat: 48, lon: -4, ts: 1 }).length, 1)
  assert.equal(fixesFromBody({ fixes: [{ lat: 48, lon: -4, ts: 1 }, { bad: true }] }).length, 1)
  assert.equal(fixesFromBody(null).length, 0)
  const big = { fixes: Array.from({ length: 999 }, (_, i) => ({ lat: 48, lon: -4, ts: i })) }
  assert.equal(fixesFromBody(big, 500).length, 500)
})

test('trimTrail drops old points and caps to newest N', () => {
  const now = 1_000_000_000
  const rows = [{ ts: now - 50 * 3600_000 }, { ts: now - 1000 }, { ts: now }]
  assert.equal(trimTrail(rows, now, 36 * 3600_000).length, 2) // 50h-old dropped at 36h retention
  const many = Array.from({ length: 10 }, (_, i) => ({ ts: now - i }))
  assert.equal(trimTrail(many, now, 36 * 3600_000, 5).length, 5)
})

test('safeEqual is constant-shape and bearerToken parses the header', () => {
  assert.equal(safeEqual('abc', 'abc'), true)
  assert.equal(safeEqual('abc', 'abd'), false)
  assert.equal(safeEqual('abc', 'ab'), false) // length mismatch
  assert.equal(safeEqual('', ''), false) // empty rejected (an unset token must never match)
  assert.equal(bearerToken('Bearer xyz'), 'xyz')
  assert.equal(bearerToken('bearer  xyz'), 'xyz')
  assert.equal(bearerToken('xyz'), '')
  assert.equal(bearerToken(undefined), '')
})
