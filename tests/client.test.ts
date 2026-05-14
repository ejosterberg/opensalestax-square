// SPDX-License-Identifier: Apache-2.0

import nock from 'nock';

import {
  OpenSalesTaxApiError,
  OpenSalesTaxClient,
  type CalculateRequest,
} from '../src/client';

const BASE_URL = 'http://engine.example.test';

describe('OpenSalesTaxClient', () => {
  beforeEach(() => {
    nock.cleanAll();
    nock.disableNetConnect();
  });

  afterEach(() => {
    // Abort any pending deferred replies so the timeout test doesn't
    // bleed a stray response into the next suite.
    nock.abortPendingRequests();
    nock.cleanAll();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  describe('constructor', () => {
    it('accepts public http URLs', () => {
      expect(() => new OpenSalesTaxClient({ baseUrl: BASE_URL })).not.toThrow();
    });

    it('rejects file: URLs', () => {
      expect(() => new OpenSalesTaxClient({ baseUrl: 'file:///etc/passwd' })).toThrow();
    });

    it('rejects RFC-1918 by default', () => {
      expect(() => new OpenSalesTaxClient({ baseUrl: 'http://10.32.161.126:8080' })).toThrow();
    });

    it('allows RFC-1918 with allowPrivate=true', () => {
      expect(
        () =>
          new OpenSalesTaxClient({
            baseUrl: 'http://10.32.161.126:8080',
            allowPrivate: true,
          }),
      ).not.toThrow();
    });

    it('strips trailing slashes', async () => {
      const client = new OpenSalesTaxClient({ baseUrl: `${BASE_URL}///` });
      nock(BASE_URL).get('/v1/health').reply(200, {
        status: 'ok',
        version: '0.55.4',
        database_connected: true,
      });
      await expect(client.healthCheck()).resolves.toMatchObject({ status: 'ok' });
    });
  });

  describe('healthCheck', () => {
    it('returns the engine health payload', async () => {
      nock(BASE_URL).get('/v1/health').reply(200, {
        status: 'ok',
        version: '0.55.4',
        database_connected: true,
      });
      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL });
      await expect(client.healthCheck()).resolves.toEqual({
        status: 'ok',
        version: '0.55.4',
        database_connected: true,
      });
    });

    it('throws OpenSalesTaxApiError on 5xx', async () => {
      nock(BASE_URL).get('/v1/health').reply(503, 'service down');
      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL });
      await expect(client.healthCheck()).rejects.toThrow(OpenSalesTaxApiError);
    });

    it('captures the status code on the thrown error', async () => {
      nock(BASE_URL).get('/v1/health').reply(500, '');
      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL });
      await expect(client.healthCheck()).rejects.toMatchObject({ status: 500 });
    });
  });

  describe('calculate', () => {
    const req: CalculateRequest = {
      address: { zip5: '55403' },
      line_items: [{ amount: '100.00', category: 'general' }],
    };

    it('POSTs JSON to /v1/calculate', async () => {
      nock(BASE_URL)
        .post('/v1/calculate', (body) => {
          expect(body.address.zip5).toBe('55403');
          return true;
        })
        .reply(200, {
          subtotal: '100.00',
          tax_total: '7.875',
          lines: [
            {
              amount: '100.00',
              category: 'general',
              tax: '7.875',
              rate_pct: '7.875',
              jurisdictions: [],
            },
          ],
        });
      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL });
      const r = await client.calculate(req);
      expect(r.tax_total).toBe('7.875');
    });

    it('sets X-API-Key header when apiKey is provided', async () => {
      nock(BASE_URL, { reqheaders: { 'X-API-Key': 'secret-123' } })
        .post('/v1/calculate')
        .reply(200, { subtotal: '0', tax_total: '0', lines: [] });
      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL, apiKey: 'secret-123' });
      await expect(client.calculate(req)).resolves.toBeDefined();
    });

    it('does not set X-API-Key when apiKey is empty string', async () => {
      nock(BASE_URL, { badheaders: ['X-API-Key'] })
        .post('/v1/calculate')
        .reply(200, { subtotal: '0', tax_total: '0', lines: [] });
      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL, apiKey: '' });
      await expect(client.calculate(req)).resolves.toBeDefined();
    });

    it('throws OpenSalesTaxApiError on 4xx with body excerpt', async () => {
      nock(BASE_URL).post('/v1/calculate').reply(400, 'bad request');
      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL });
      await expect(client.calculate(req)).rejects.toMatchObject({
        status: 400,
        name: 'OpenSalesTaxApiError',
      });
    });

    it('throws OpenSalesTaxApiError on network failure', async () => {
      nock(BASE_URL).post('/v1/calculate').replyWithError('ECONNREFUSED');
      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL });
      await expect(client.calculate(req)).rejects.toThrow(OpenSalesTaxApiError);
    });

    it('throws OpenSalesTaxApiError on malformed JSON', async () => {
      nock(BASE_URL).post('/v1/calculate').reply(200, 'not json{');
      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL });
      await expect(client.calculate(req)).rejects.toThrow(OpenSalesTaxApiError);
    });

    it('aborts on timeout', async () => {
      nock(BASE_URL)
        .post('/v1/calculate')
        .delay(200)
        .reply(200, { subtotal: '0', tax_total: '0', lines: [] });
      const client = new OpenSalesTaxClient({ baseUrl: BASE_URL, timeoutMs: 50 });
      await expect(client.calculate(req)).rejects.toThrow(OpenSalesTaxApiError);
    });
  });
});
