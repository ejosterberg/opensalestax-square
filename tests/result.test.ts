// SPDX-License-Identifier: Apache-2.0

import { buildResult, buildSkippedResult, CALCULATION_DISCLAIMER } from '../src/result';
import type { CalculationResult } from '@ejosterberg/opensalestax';

const sampleEngineResponse: CalculationResult = {
  subtotal: '100.00',
  taxTotal: '7.875',
  lines: [
    {
      amount: '100.00',
      category: 'general',
      tax: '7.875',
      ratePct: '7.875',
      jurisdictions: [
        { type: 'STATE', name: 'Minnesota', ratePct: '6.875', tax: '6.875' },
        { type: 'CITY', name: 'Minneapolis', ratePct: '0.500', tax: '0.500' },
      ],
      note: null,
    },
  ],
  disclaimer: 'Calculation only.',
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
    const resp: CalculationResult = {
      subtotal: '0',
      taxTotal: '0',
      lines: [
        {
          amount: '0',
          category: 'general',
          tax: '0',
          ratePct: '0',
          // intentionally cast around the type to drop jurisdictions
          jurisdictions: undefined as unknown as [],
          note: null,
        },
      ],
      disclaimer: '',
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
