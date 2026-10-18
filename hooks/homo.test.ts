import { test, expect } from 'claude-code/testing'
import { evaluate, evaluateInt, homo, tableSize } from './homo.ts'

const ONLY_THESE = /^[-+*/()1451]+$/

test('the generated table holds a few hundred whole numbers directly', async () => {
  expect(tableSize()).toBeGreaterThan(500)
  expect(evaluateInt(homo(1000))).toBe(1000)
})

test('every expression is exactly its number and uses only 1, 4, 5 and operators', async () => {
  const samples = [0, 1, 2, 3, 7, 9, 10, 16, 24, 42, 100, 114, 514, 810, 1000, 1919, 2026, 4545, 114514, 1919810, 123456789]
  for (const n of samples) {
    const s = homo(n)
    expect(ONLY_THESE.test(s)).toBe(true)
    expect(evaluateInt(s)).toBe(n)
  }
})

test('the first five hundred whole numbers all come out right', async () => {
  for (let n = 0; n <= 500; n++) expect(evaluateInt(homo(n))).toBe(n)
})

test('114514 is itself', async () => {
  expect(homo(114514)).toBe('114514')
})

test('negative numbers ride on minus one', async () => {
  expect(evaluateInt(homo(-20))).toBe(-20)
  expect(homo(-20).startsWith('(')).toBe(true)
})

test('non-whole input is rounded', async () => {
  expect(evaluateInt(homo(19.6))).toBe(20)
})

test('the evaluators are sane', async () => {
  expect(evaluate('1*14*5*14-11+45-14')).toBe(1000)
  expect(evaluateInt('114514*(11-4-5+14)+(114*514+(114*51*4+(1145*(1+4)+(11-4+5+1-4))))')).toBe(1919810)
  expect(evaluateInt('-11+4-5+14')).toBe(2)
  expect(evaluateInt('11/(45-1)*4')).toBe(1)
  expect(evaluateInt('11/4')).toBe(null)
})
