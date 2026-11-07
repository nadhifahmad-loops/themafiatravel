import test from 'node:test';
import assert from 'node:assert/strict';
import { signCloudinaryParams } from './upload-storage';

// Contoh resmi dari dokumentasi Cloudinary ("Generating authentication signatures").
test('signCloudinaryParams cocok dengan contoh di dokumentasi Cloudinary', () => {
  const sig = signCloudinaryParams(
    {
      eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
      public_id: 'sample_image',
      timestamp: 1315060510,
    },
    'abcd',
  );
  assert.equal(sig, 'bfd09f95f331f558cbd1320e67aa8d488770583e');
});

test('signCloudinaryParams mengurutkan parameter dan mengabaikan nilai kosong', () => {
  const a = signCloudinaryParams({ timestamp: 1, folder: 'x', empty: '' }, 's');
  const b = signCloudinaryParams({ folder: 'x', timestamp: 1 }, 's');
  assert.equal(a, b);
});
