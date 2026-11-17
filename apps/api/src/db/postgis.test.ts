import '../env.js';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { polygonAreaHa } from '@droneverse/shared';
import { buildApp } from '../app.js';
import { closePool, getPool } from './pool.js';

// These tests talk to the real database in DATABASE_URL, so they only run on request:
//   RUN_DB_TESTS=1 pnpm --filter @droneverse/api test
// Hosted-database round trips are slow, so allow plenty of time.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });
const run = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

const SHAPES = {
  'rectangle near Nairobi': [
    [36.8, -1.3],
    [36.81, -1.3],
    [36.81, -1.29],
    [36.8, -1.29],
    [36.8, -1.3],
  ],
  'irregular polygon': [
    [36.8, -1.3],
    [36.812, -1.298],
    [36.815, -1.29],
    [36.806, -1.286],
    [36.798, -1.294],
    [36.8, -1.3],
  ],
  'high latitude': [
    [10, 60],
    [10.02, 60],
    [10.02, 60.01],
    [10, 60.01],
    [10, 60],
  ],
};

run('PostGIS', () => {
  afterAll(closePool);

  for (const [name, ring] of Object.entries(SHAPES)) {
    it(`area matches the shared calculation within 1%: ${name}`, async () => {
      const geojson = JSON.stringify({ type: 'Polygon', coordinates: [ring] });
      const { rows } = await getPool().query<{ ha: number }>(
        'select ST_Area(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography) / 10000 as ha',
        [geojson],
      );
      const expected = polygonAreaHa({ coordinates: [ring as number[][]] });
      expect(Math.abs(rows[0]!.ha - expected) / expected).toBeLessThan(0.01);
    });
  }
});

run('farm and field flow (creates and deletes a temporary user)', () => {
  const email = `test-${Date.now()}@droneverse.invalid`;
  afterAll(async () => {
    await getPool().query('delete from users where email = $1', [email]);
    await closePool();
  });

  it('signs up, creates a farm with 3 fields, reads them back, and enforces ownership', async () => {
    const app = buildApp();
    const reg = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'a-long-test-password', name: 'Test' },
    });
    expect(reg.statusCode).toBe(201);
    const auth = { authorization: `Bearer ${reg.json().token}` };

    const farm = (
      await app.inject({
        method: 'POST',
        url: '/farms',
        headers: auth,
        payload: { name: 'Test Farm' },
      })
    ).json().farm;

    for (const [i, ring] of Object.values(SHAPES).entries()) {
      const res = await app.inject({
        method: 'POST',
        url: `/farms/${farm.id}/fields`,
        headers: auth,
        payload: {
          name: `Field ${i + 1}`,
          crop: 'Maize',
          boundary: { type: 'Polygon', coordinates: [ring] },
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().field.areaHa).toBeGreaterThan(0);
    }

    const list = await app.inject({
      method: 'GET',
      url: `/farms/${farm.id}/fields`,
      headers: auth,
    });
    expect(list.json().fields).toHaveLength(3);

    // A self-intersecting "bow tie" is rejected.
    const bow = await app.inject({
      method: 'POST',
      url: `/farms/${farm.id}/fields`,
      headers: auth,
      payload: {
        name: 'Bad',
        crop: 'Maize',
        boundary: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 1],
              [1, 0],
              [0, 1],
              [0, 0],
            ],
          ],
        },
      },
    });
    expect(bow.statusCode).toBe(400);

    // No token, no access.
    expect((await app.inject({ method: 'GET', url: '/farms' })).statusCode).toBe(401);
    await app.close();
  });
});
