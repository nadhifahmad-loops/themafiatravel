import { hotelAPI } from '@/lib/orbis';
import fs from 'fs';

// Matriks tes: destination_id, checkin, checkout, nationality, adult, child, room, child_ages
const CASES: Array<{ label: string; body: Record<string, unknown> }> = [
  {
    label: 'SG7355 · 1R/2A/0C · nat ID (persis log dev kemarin)',
    body: { checkin_date: '2026-09-19', checkout_date: '2026-09-20', destination_id: 'SG7355', adult: 2, child: 0, child_ages: [], room: 1, nationality: 'ID' },
  },
  {
    label: 'SG7355 · 1R/2A/0C · nat SG (sesuai doc §3.4.2.1)',
    body: { checkin_date: '2026-09-19', checkout_date: '2026-09-20', destination_id: 'SG7355', adult: 2, child: 0, child_ages: [], room: 1, nationality: 'SG' },
  },
  {
    label: 'SG7355 · 1R/2A/0C · nat SG · tanggal jauh',
    body: { checkin_date: '2026-10-10', checkout_date: '2026-10-12', destination_id: 'SG7355', adult: 2, child: 0, child_ages: [], room: 1, nationality: 'SG' },
  },
  {
    label: 'ID8731 (Bali) · 1R/2A/0C · nat ID',
    body: { checkin_date: '2026-09-19', checkout_date: '2026-09-20', destination_id: 'ID8731', adult: 2, child: 0, child_ages: [], room: 1, nationality: 'ID' },
  },
  {
    label: 'ID339 (Jakarta) · 1R/2A/0C · nat ID',
    body: { checkin_date: '2026-09-19', checkout_date: '2026-09-20', destination_id: 'ID339', adult: 2, child: 0, child_ages: [], room: 1, nationality: 'ID' },
  },
  {
    label: 'MY5411 (KL) · 1R/2A/0C · nat MY',
    body: { checkin_date: '2026-09-19', checkout_date: '2026-09-20', destination_id: 'MY5411', adult: 2, child: 0, child_ages: [], room: 1, nationality: 'MY' },
  },
  {
    label: 'SG7355 · 2R/4A/2C (umur 5,7) · nat SG (pola §3.4.3.1)',
    body: { checkin_date: '2026-11-21', checkout_date: '2026-11-23', destination_id: 'SG7355', adult: 4, child: 2, child_ages: [5, 7], room: 2, nationality: 'SG' },
  },
  {
    label: 'GB0599 (London) · 1R/2A/0C · nat GB',
    body: { checkin_date: '2026-09-19', checkout_date: '2026-09-20', destination_id: 'GB0599', adult: 2, child: 0, child_ages: [], room: 1, nationality: 'GB' },
  },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function summaryOf(data: unknown): string {
  const record = asRecord(data);
  if (!record) return String(data);
  const hotelList = Array.isArray(record.hotel_ids) ? record.hotel_ids : [];
  const cityList = Array.isArray(record.city_ids) ? record.city_ids : [];
  const keys = Object.keys(record);
  return `response keys=[${keys.join(', ')}] hotel_ids=${hotelList.length} city_ids=${cityList.length}`;
}

(async () => {
  const startedAt = new Date().toISOString();
  fs.writeFileSync('hotel-search-test-results.md', `# Hasil Batch Test Search Hotel (Orbisway)\n\n**Waktu mulai:** ${startedAt}\n**Method:** memakai code path produksi — \`hotelAPI.search\` (\`lib/orbis.ts\`, termasuk signin, normalisasi \`child_ages\`, dan retry otomatis 3x).\n\n`, 'utf8');

  const lines: string[] = [];
  for (const c of CASES) {
    const t0 = Date.now();
    console.log(`\n=== TEST: ${c.label} ===`);
    try {
      const data: unknown = await hotelAPI.search(c.body);
      const ms = Date.now() - t0;
      const line = `- **PASS** (${ms}ms) — ${summaryOf(data)}`;
      lines.push(`\n### ${c.label}\n\n**Payload:**
\`\`\`json
${JSON.stringify(c.body, null, 2)}
\`\`\`

**Hasil:** \`error_code: 0\` dalam ${ms}ms → ${summaryOf(data)}

\`\`\`json
${JSON.stringify(data, null, 2).slice(0, 8000)}
\`\`\`
`);
      console.log(line);
    } catch (e: unknown) {
      const error = asRecord(e) ?? {};
      const ms = Date.now() - t0;
      const line = `- **FAIL** (${ms}ms) — code=${error.orbisCode} msg=${error.message}`;
      lines.push(`\n### ${c.label}\n\n**Payload:**
\`\`\`json
${JSON.stringify(c.body, null, 2)}
\`\`\`

**Hasil:** \`ORBIS ERROR\` dalam ${ms}ms
- \`error_code\`: \`${error.orbisCode}\`
- \`error_msg\`: \`${error.message}\`
- \`orbisResponse\`: \`${JSON.stringify(error.orbisResponse ?? null)}\`

\`\`\``);
      console.log(line);
    }
  }

  lines.push(`\n---\n\n**Waktu selesai:** ${new Date().toISOString()}\n`);
  fs.appendFileSync('hotel-search-test-results.md', lines.join('\n'), 'utf8');
  console.log('\n\nHasil lengkap ditulis ke: hotel-search-test-results.md');
})();