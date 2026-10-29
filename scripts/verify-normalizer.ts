import { normalizeInsuranceProduct } from '../lib/insurance-benefits';

// Recreate the exact real world inputs captured from the live API, then assert
// the UI-critical invariants.
let failures = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (!cond) { failures++; console.log(`  ✗ ${name}${got !== undefined ? ' — got: ' + JSON.stringify(got) : ''}`); }
  else console.log(`  ✓ ${name}`);
}

// ── Assist Card: `info` is `Label: value` lines, no table, no benefits ──
const assist = {
  product_name: 'AC 150 DAILY 7 to 8 DAYS', product_code: 'I04 40005',
  provider: 'assistcard', carrier_code: 'assistcard', carrier_name: 'Assist Card',
  sector_type: 'International', data_name: 'Asia', type_trip_name: 'Individual',
  minAdultOld: 0, maxAdultOld: 69, total_price: 435000, additional_benefit: [],
  info: 'Description: Medical Assistance in case of Accident or non pre-existent illness up to USD 150.000<br><br>Travel type: Daily<br>Minimum age: 0<br>Maximum age: 69<br>Age limits: No age limits',
};
console.log('\n── Assist Card (label-lines info) ──');
{
  const n = normalizeInsuranceProduct(assist, 'ID');
  check('description = the Description: line only', n.description === 'Medical Assistance in case of Accident or non pre-existent illness up to USD 150.000', n.description);
  check('description has no "Travel type"/"Minimum age"', !/Travel type|Minimum age|Maximum age|Age limits/.test(n.description), n.description);
  check('description has no markup', !/[<>{}]|Description:/.test(n.description), n.description);
  check('travelType = Daily', n.travelType === 'Daily', n.travelType);
  check('age min/max from info lines', n.ageRange.minAge === '0' && n.ageRange.maxAge === '69', n.ageRange);
  check('requirement = No age limits', n.ageRange.requirement === 'No age limits', n.ageRange.requirement);
  check('no benefits (provider sends none)', n.benefits.length === 0, n.benefits.length);
  check('3 highlights, all null', n.highlights.length === 3 && n.highlights.every((h) => h.limitText === null));
  // Structured fallback — hanya field yang benar-benar dikirim provider.
  const pd = Object.fromEntries(n.planDetails.map((r) => [r.key, r.value]));
  check('planDetails package = Individual', pd.package === 'Individual', pd.package);
  check('planDetails tripType = Daily (baris provider)', pd.tripType === 'Daily', pd.tripType);
  check('planDetails coverageArea = Internasional · Asia', pd.coverageArea === 'Internasional \u00b7 Asia', pd.coverageArea);
  check('planDetails ageRange = 0–69', pd.ageRange === '0\u201369', pd.ageRange);
  check('planDetails has NO pax (field tidak dikirim)', pd.participants === undefined, pd.participants);
  const enPd = Object.fromEntries(normalizeInsuranceProduct(assist, 'EN').planDetails.map((r) => [r.key, r.value]));
  check('EN coverageArea = International · Asia', enPd.coverageArea === 'International \u00b7 Asia', enPd.coverageArea);
}

// ── Assist Card: `Age limits:` kosong, isinya di baris lanjutan ──
const assistAgeLimits = {
  ...assist,
  info: 'Description: Medical Assistance up to USD 15.000<br>Travel type: Daily<br>Minimum age: 0<br>Maximum age: 200<br>Age limits: <br>- Age 70, price increase by 50.0%<br>- Age 75, price increase by 100.0%',
};
console.log('\n── Assist Card (Age limits continuation lines) ──');
{
  const n = normalizeInsuranceProduct(assistAgeLimits, 'ID');
  check('requirement joins continuation lines', n.ageRange.requirement === 'Age 70, price increase by 50.0%; Age 75, price increase by 100.0%', n.ageRange.requirement);
  check('continuation lines are not benefits', n.benefits.length === 0, n.benefits.map((b) => b.label));
}

// ── Zurich/Oona: `info` is a <style> + <table>, plus add-on packs ──
const tableInfo = '<style>th,td{border: 1px solid black;padding: 8px;text-align: center;}table{width: 100%;border-collapse: collapse;}</style>'
  + '<table><tr><th><b>Benefits</b></th><th><b>Coverage</b></tr>'
  + '<tr><td>Santunan Kecelakaan Diri / Personal Accident Allowance</td><td>Age: <18 y.o max 25%, >18 th - 69 th: 100%</td></tr>'
  + '<tr><td><b>Biaya Pengobatan dan Perawatan Medis / Medical Expenses</b></td><td></td></tr>'
  + '<tr><td>Biaya Pengobatan Akibat Sakit / Medical Expense Due To Illness</td><td>750,000,000</td></tr>'
  + '<tr><td>Kompensasi Atas Keterlambatan Bagasi / Compensation for Baggage Delay</td><td>2,250,000 (750.000 per 4 jam/hour)</td></tr>'
  + '<tr><td>Santunan atas Penundaan Transportasi / Allowance Due To Transport Departure Delay</td><td>3,000,000 (750.000 per 4 jam/hour)</td></tr>'
  + '<tr><td>Kompensasi Kerusakan dan Kehilangan Barang Pribadi / Compensation for Personal Belongings Maksimum 3.000.000/item/set</td><td>25,000,000</td></tr>'
  + '</table>';
const oona = {
  product_name: 'Travel Guardia Individual International APAC Platinum', product_code: '1216-APC-3',
  provider: 'oona', carrier_code: 'oona', carrier_name: 'Oona', sector_type: 'International',
  data_name: 'international_apac', type_trip_name: 'Individual',
  minAdultOld: 18, maxAdultOld: 200, total_price: 265400,
  info: tableInfo,
  additional_benefit: [
    { id: 'WS01~A', price: 58500, text: ['Olahraga Musim Dingin / Winter Sports A', ''], child: [
      { text: ['<i>Olahraga Musim Dingin / Winter Sports</i>', ''], detail: [''] },
      { text: ['▸ Paket Olahraga Musim Dingin / Winter Sports Pack', ''], detail: ['15,000,000'] },
    ] },
  ],
};
console.log('\n── Oona (table info + add-ons) ──');
{
  const n = normalizeInsuranceProduct(oona, 'ID');
  check('description has no table/CSS', !/border:1px|width:100%|<|Personal Accident|Age:/.test(n.description), n.description);
  check('description humanizes data_name', /APAC/i.test(n.description) && !/international_apac/.test(n.description), n.description);
  check('5 real benefits (group header skipped)', n.benefits.length === 5, n.benefits.length);
  check('group header not a benefit', !n.benefits.some((b) => /Medical Expenses$/.test(b.label)));
  check('bilingual ID label', n.benefits.some((b) => b.label === 'Biaya Pengobatan Akibat Sakit'), n.benefits.map((b) => b.label));
  const acc = n.highlights.find((h) => h.key === 'accident');
  const bag = n.highlights.find((h) => h.key === 'baggage');
  const del = n.highlights.find((h) => h.key === 'delay');
  check('accident max = Rp 750.000.000', acc?.limitText === 'Rp 750.000.000', acc?.limitText);
  check('baggage max = Rp 25.000.000', bag?.limitText === 'Rp 25.000.000', bag?.limitText);
  check('delay max = Rp 3.000.000', del?.limitText === 'Rp 3.000.000', del?.limitText);
  check('addons parsed separately (1)', n.addons.length === 1, n.addons.length);
  check('addon has price + child items', n.addons[0]?.price === 58500 && n.addons[0]?.items.length === 2, n.addons[0]);
  check('addon child amount formatted', n.addons[0]?.items[1]?.value === 'Rp 15.000.000', n.addons[0]?.items[1]?.value);

  const en = normalizeInsuranceProduct(oona, 'EN');
  check('EN labels use English side', en.benefits.some((b) => b.label === 'Medical Expense Due To Illness'), en.benefits.map((b) => b.label));
}

// ── Zurich: `info: ""` + `additional_benefit: []` — nol manfaat ──
const zurich = {
  product_name: 'Zurich Asia Lite Individual', product_code: '16497',
  provider: 'zurich', carrier_code: 'zurich', carrier_name: 'Zurich',
  sector_type: 'International', data_name: 'ASIA', type_trip_name: 'Individual',
  product_type_code: 'individual', type: 'single_trip',
  minChildOld: 0, maxChildOld: 23, minAdultOld: 24, maxAdultOld: 69,
  minAdult: 1, maxAdult: 1, minPax: 1, maxPax: 1, total_price: 202500,
  info: '', additional_benefit: [], pdf: '',
};
console.log('\n── Zurich (info kosong → rincian terstruktur) ──');
{
  const n = normalizeInsuranceProduct(zurich, 'ID');
  check('no benefits (provider sends none)', n.benefits.length === 0, n.benefits.length);
  const pd = Object.fromEntries(n.planDetails.map((r) => [r.key, r.value]));
  check('planDetails package = Individual', pd.package === 'Individual', pd.package);
  check('planDetails coverageArea = Internasional · Asia', pd.coverageArea === 'Internasional \u00b7 Asia', pd.coverageArea);
  check('planDetails ageRange = 24–69', pd.ageRange === '24\u201369', pd.ageRange);
  check('planDetails participants = 1 (min === max)', pd.participants === '1', pd.participants);
  check('no tripType row (provider tidak kirim)', pd.tripType === undefined, pd.tripType);
  check('synthesized description, no codes', n.description.includes('Asia') && !/ASIA|single_trip/.test(n.description), n.description);
  check('planDetails present even with empty benefits', n.planDetails.length === 4, n.planDetails.length);
}

// ── Great Eastern: tabel dengan header `Benefits | Amount` ──
const ge = {
  product_name: 'Great Eastern Traveller Plus', product_code: 'GT-001',
  provider: 'great_eastern', carrier_code: 'great_eastern', carrier_name: 'Great Eastern',
  sector_type: 'International', data_name: 'SINGAPORE', type_trip_name: 'Individual',
  type: 'DAILY', minAdultOld: 1, maxAdultOld: 70, minPax: 1, maxPax: 1, total_price: 175000,
  additional_benefit: [],
  info: '<table><tr><th>Benefits</th><th>Amount</th></tr>'
    + '<tr><td>Biaya Pengobatan dan Tambahan.</td><td>350,000,000.00</td></tr>'
    + '<tr><td>Santunan Meninggal Dunia.</td><td>500,000,000.00</td></tr></table>',
};
console.log('\n── Great Eastern (header Benefits | Amount) ──');
{
  const n = normalizeInsuranceProduct(ge, 'ID');
  check('header row skipped (bukan manfaat)', !n.benefits.some((b) => b.label === 'Benefits'), n.benefits.map((b) => b.label));
  check('2 real benefits', n.benefits.length === 2, n.benefits.length);
  check('amount parsed (350 juta)', n.benefits[0]?.value === 'Rp 350.000.000', n.benefits[0]?.value);
  check('accident highlight picks it up', n.highlights.find((h) => h.key === 'accident')?.limitText === 'Rp 500.000.000', n.highlights.find((h) => h.key === 'accident')?.limitText);
  check('planDetails still built', n.planDetails.length > 0, n.planDetails);
}

// ── Garbage inputs must never throw ──
console.log('\n── Defensive ──');
for (const bad of [null, undefined, 42, 'x', [], {}, { info: null, additional_benefit: {} }, { info: 123, additional_benefit: 'x' }]) {
  try {
    const n = normalizeInsuranceProduct(bad, 'ID');
    check(`no throw for ${JSON.stringify(bad)}`, Array.isArray(n.highlights) && Array.isArray(n.benefits) && Array.isArray(n.addons));
  } catch (e) {
    failures++; console.log(`  ✗ threw for ${JSON.stringify(bad)}: ${(e as Error).message}`);
  }
}

console.log(failures === 0 ? '\n✅ ALL CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
