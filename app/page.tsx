import HomeClient from '@/components/home/HomeClient';
import { getActivePromos } from '@/lib/promos';

/**
 * Halaman utama.
 *
 * Server component ini hanya bertugas mengambil kartu promo dari database
 * lalu meneruskannya ke konten client — supaya teks promo sudah ada di HTML
 * awal dan tidak menunggu fetch dari browser.
 *
 * Seluruh konten interaktif ada di `components/home/HomeClient.tsx`.
 */
export default async function HomePage() {
  const promos = await getActivePromos();

  return <HomeClient promos={promos} />;
}
