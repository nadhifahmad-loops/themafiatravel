import { insuranceAPI } from '@/lib/orbis';
import {
  addDays,
  getInsuranceConfig,
  normalizeTripFamily,
  resolveProductTypeFromConfig,
  resolveInsuranceDestinationArea,
  resolveInsuranceDestination,
  resolveTripFromConfig,
  supportsSeniorFromConfig,
} from '@/lib/insurance-providers';

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
  const international = family === 'annual'
    ? true
    : (params.international ?? !/domestic|domestik/i.test(params.destinationArea || ''));
  const dateEnd = family === 'annual'
    ? addDays(params.dateStart, trip?.dateSetting ?? 365)
    : params.dateEnd;

  const area = resolveInsuranceDestinationArea(
    params.provider,
    family === 'annual' ? 'Worldwide' : (params.destinationArea || params.destination || 'Asia'),
    international,
    config[params.provider]?.areas,
    family,
  );
  const result = await insuranceAPI.getAvailability({
    date_start: params.dateStart,
    date_end: dateEnd,
    pax: params.pax,
    destination: international && family !== 'annual'
      ? resolveInsuranceDestination(params.destination || '', config[params.provider]?.destinations)
      : '',
    is_senior: (params.isSenior ?? false) && supportsSenior,
    international,
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
