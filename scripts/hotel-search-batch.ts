import { hotelAPI } from '@/lib/orbis';
import fs from 'fs';

// Matriks tes: destination_id, checkin, checkout, nationality, adult, child, room, child_ages
const CASES: Array<{ label: string; body: Record<string, unknown> }> = [
  {
    label: 'SG7355 · 1R/2A/0C · nat ID (persis log dev kemarin)',
    body: { checkin_date: '2026-09-19', checkout_date: '2026-09-20', destination_id: 'SG7355', search_name: '', adult: 2, child: 0, child_ages: [], room: 1, nationality: 'ID' },
  },
  {
    label: 'SG7355 · 1R/2A/0C · nat SG (sesuai doc §3.4.2.1)',
    body: { checkin_date: '2026-09-19', checkout_date: '2026-09-20', destination_id: 'SG7355', search_name: '', adult: 2, child: 0, child_ages: [], room: 1, nationality: 'SG' },
  },
  {
    label: 'SG7355 · 1R/2A/0C · nat SG · tanggal jauh',
    body: { checkin_date: '2026-10-10', checkout_date: '2026-10-12', destination_id: 'SG7355', search_name: '', adult: 2, child: 0, child_ages: [], room: 1, nationality: 'SG' },
  },
  {
    label: 'ID8731 (Bali) · 1R/2A/0C · nat ID',
    body: { checkin_date: '2026-09-19', checkout_date: '2026-09-20', destination_id: 'ID8731', search_name: '', adult: 2, child: 0, child_ages: [], room: 1, nationality: 'ID' },
  },
  {
    label: 'ID339 (Jakarta) · 1R/2A/0C · nat ID',
    body: { checkin_date: '2026-09-19', checkout_date: '2026-09-20', destination_id: 'ID339', search_name: '', adult: 2, child: 0, child_ages: [], room: 1, nationality: 'ID' },
  },
  {
    label: 'MY5411 (KL) · 1R/2A/0C · nat MY',
    body: { checkin_date: '2026-09-19', checkout_date: '2026-09-20', destination_id: 'MY5411', search_name: '', adult: 2, child: 0, child_ages: [], room: 1, nationality: 'MY' },
  },
  {
    label: 'SG7355 · 2R/4A/2C (umur 5,7) · nat SG (pola §3.4.3.1)',
    body: { checkin_date: '2026-11-21', checkout_date: '2026-11-23', destination_id: 'SG7355', search_name: '', adult: 4, child: 2, child_ages: [5, 7], room: 2, nationality: 'SG' },
  },
  {
    label: 'GB0599 (London) · 1R/2A/0C · nat GB',
    body: { checkin_date: '2026-09-19', checkout_date: '2026-09-20', destination_id: 'GB0599', search_name: '', adult: 2, child: 0, child_ages: [], room: 1, nationality: 'GB' },
  },
];

function summaryOf(data: any): string {
  if (!data || typeof data !== 'object') return String(data);
  const hotelList = Array.isArray(data.hotel_ids) ? data.hotel_ids : [];
  const cityList = Array.isArray(data.city_ids) ? data.city_ids : [];
  const keys = Object.keys(data);
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
      const data = (await hotelAPI.search(c.body)) as any;
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
    } catch (e: any) {
      const ms = Date.now() - t0;
      const line = `- **FAIL** (${ms}ms) — code=${e?.orbisCode} msg=${e?.message}`;
      lines.push(`\n### ${c.label}\n\n**Payload:**
\`\`\`json
${JSON.stringify(c.body, null, 2)}
\`\`\`

**Hasil:** \`ORBIS ERROR\` dalam ${ms}ms
- \`error_code\`: \`${e?.orbisCode}\`
- \`error_msg\`: \`${e?.message}\`
- \`orbisResponse\`: \`${JSON.stringify(e?.orbisResponse ?? null)}\`

\`\`\``);
      console.log(line);
    }
  }

  lines.push(`\n---\n\n**Waktu selesai:** ${new Date().toISOString()}\n`);
  fs.appendFileSync('hotel-search-test-results.md', lines.join('\n'), 'utf8');
  console.log('\n\nHasil lengkap ditulis ke: hotel-search-test-results.md');
})();