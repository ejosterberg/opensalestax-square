// SPDX-License-Identifier: Apache-2.0

import { buildResult, buildSkippedResult, CALCULATION_DISCLAIMER } from '../src/result';
import type { CalculateResponse } from '../src/client';

const sampleEngineResponse: CalculateResponse = {
  subtotal: '100.00',
  tax_total: '7.875',
  lines: [
    {
      amount: '100.00',
      category: 'general',
      tax: '7.875',
      rate_pct: '7.875',
      jurisdictions: [
        { type: 'STATE', name: 'Minnesota', rate_pct: '6.875', tax: '6.875' },
        { type: 'CITY', name: 'Minneapolis', rate_pct: '0.500', tax: '0.500' },
      ],
      note: null,
    },
  ],
};

describe('buildResult', () => {
  it('maps engine response 1:1 with camelCase ratePct', () => {
    const got = buildResult(sampleEngineResponse, ['line_a']);
    expect(got.subtotal).toBe('100.00');
    expect(got.taxTotal).toBe('7.875');
    expect(got.lines).toHaveLength(1);
    const line = got.lines[0];
    expect(line?.ratePct).toBe('7.875');
    expect(line?.jurisdictions).toEqual([
      { type: 'STATE', name: 'Minnesota', ratePct: '6.875', tax: '6.875' },
      { type: 'CITY', name: 'Minneapolis', ratePct: '0.500', tax: '0.500' },
    ]);
  });

  it('attaches squareUid when present', () => {
    const got = buildResult(sampleEngineResponse, ['line_a']);
    expect(got.lines[0]?.squareUid).toBe('line_a');
  });

  it('omits squareUid when undefined', () => {
    const got = buildResult(sampleEngineResponse, [undefined]);
    expect(got.lines[0]?.squareUid).toBeUndefined();
    expect('squareUid' in (got.lines[0] ?? {})).toBe(false);
  });

  it('always emits the disclaimer', () => {
    const got = buildResult(sampleEngineResponse, [undefined]);
    expect(got.disclaimer).toBe(CALCULATION_DISCLAIMER);
  });

  it('handles missing jurisdictions array', () => {
    const resp: CalculateResponse = {
      subtotal: '0',
      tax_total: '0',
      lines: [
        {
          amount: '0',
          category: 'general',
          tax: '0',
          rate_pct: '0',
          // intentionally cast around the type to drop jurisdictions
          ...({} as Record<string, never>),
          jurisdictions: undefined as unknown as [],
        },
      ],
    };
    const got = buildResult(resp, [undefined]);
    expect(got.lines[0]?.jurisdictions).toEqual([]);
  });
});

describe('buildSkippedResult', () => {
  it('returns zero tax with the reason', () => {
    const got = buildSkippedResult('non_usd');
    expect(got.taxTotal).toBe('0.00');
    expect(got.subtotal).toBe('0.00');
    expect(got.skippedReason).toBe('non_usd');
    expect(got.lines).toEqual([]);
    expect(got.disclaimer).toBe(CALCULATION_DISCLAIMER);
  });

  it('attaches engineError when supplied', () => {
    const got = buildSkippedResult('engine_error', 0, 'ECONNREFUSED');
    expect(got.engineError).toBe('ECONNREFUSED');
  });
});
