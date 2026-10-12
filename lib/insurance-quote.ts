import { insuranceAPI } from '@/lib/orbis';
import {
  addDays,
  getInsuranceConfig,
  normalizeTripFamily,
  resolveProductTypeFromConfig,
  resolveTripFromConfig,
  supportsSeniorFromConfig,
} from '@/lib/insurance-providers';

const PROVIDER_AREAS: Record<string, string[]> = {
  assistcard: ['Europe', 'North America', 'Central America and Caribbean', 'South America', 'Africa', 'Asia', 'Oceania', 'Domestic', 'Receptive', 'Annual Card', 'Multiple Destinations'],
  bcainsurance: ['Asia Pasifik', 'Worldwide', 'Negara Schengen', 'Domestik'],
  zurich: ['Worldwide Excluding USA, Canada', 'Europe', 'Asia Pacific', 'Asia', 'Schengen', 'Worldwide', 'ASEAN', 'Domestic'],
  great_eastern: ['ASEAN', 'Asia Pacific', 'Domestic', 'Worldwide', 'Worldwide exc US/Canada'],
  oona: ['All'],
};

function pickArea(provider: string, requestedArea: string): string {
  const areas = PROVIDER_AREAS[provider] || [];
  if (areas.includes(requestedArea)) return requestedArea;
  const lower = requestedArea.toLowerCase();
  const matchingArea = areas.find((area) => area.toLowerCase().includes(lower) || lower.includes(area.toLowerCase()));
  if (matchingArea) return matchingArea;
  if (provider === 'oona') return 'All';
  return areas.find((area) => /domestic|domestik/i.test(area)) || areas[0] || requestedArea;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function getProducts(result: unknown, provider: string): Record<string, unknown>[] {
  const root = asRecord(result);
  const response = asRecord(root?.response);
  const data = asRecord(root?.data);
  const candidates = [root?.[provider], response?.[provider], data?.[provider], root?.response, root?.data, result];
  const products = candidates.find((value) => Array.isArray(value));
  return Array.isArray(products)
    ? products.filter((product): product is Record<string, unknown> => Boolean(asRecord(product)))
    : [];
}

function productCode(product: Record<string, unknown>): string {
  return String(product.product_code || product.plan_code || product.code || '');
}

function productPrice(product: Record<string, unknown>): number {
  return Number(product.total_price ?? product.price_total ?? product.premium ?? product.price ?? 0);
}

export async function revalidateInsurancePrice(params: {
  productCode: string;
  provider: string;
  carrierCode?: string;
  dateStart: string;
  dateEnd: string;
  pax: number;
  destination?: string;
  destinationArea?: string;
  international?: boolean;
  isSenior?: boolean;
  type?: string;
  productType?: string;
}) {
  // `type` dari UI generik; kode master_trip resmi & date_setting diambil dari get_config.
  const family = normalizeTripFamily(params.type);
  const config = await getInsuranceConfig();
  const trip = resolveTripFromConfig(config, params.provider, family);
  const supportsSenior = supportsSeniorFromConfig(config, params.provider);
  const productType = resolveProductTypeFromConfig(config, params.provider, params.productType || 'individual');
  const dateEnd = family === 'annual'
    ? addDays(params.dateStart, trip?.dateSetting ?? 365)
    : params.dateEnd;

  const area = pickArea(params.provider, params.destinationArea || params.destination || 'Asia');
  const result = await insuranceAPI.getAvailability({
    date_start: params.dateStart,
    date_end: dateEnd,
    pax: params.pax,
    destination: params.destination || '',
    is_senior: (params.isSenior ?? false) && supportsSenior,
    international: params.international ?? !/domestic|domestik/i.test(area),
    destination_area: area,
    type: trip?.code ?? params.type ?? 'single_trip',
    provider: params.provider,
    product_type: productType,
    carrier_code: params.carrierCode || params.provider,
    age: '',
  }, { timeoutMs: 30000, maxRetries: 1 });

  const product = getProducts(result, params.provider).find((item) => productCode(item) === params.productCode);
  const price = product ? productPrice(product) : 0;
  return { price, area, product };
}
