-- FIX (Bug #5): Booking.userId sebelumnya ON DELETE RESTRICT, padahal kolomnya
-- opsional dan endpoint DELETE /api/user/delete mengasumsikan user dengan booking
-- tetap bisa menghapus akunnya. Dengan RESTRICT, setiap user yang punya minimal
-- satu booking TIDAK BISA menghapus akun (query akan gagal karena FK constraint).
-- Ganti ke SET NULL: booking tetap tersimpan (riwayat transaksi untuk audit/pajak),
-- hanya kepemilikannya yang dilepas saat user menghapus akun.

ALTER TABLE "Booking" DROP CONSTRAINT "Booking_userId_fkey";

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
