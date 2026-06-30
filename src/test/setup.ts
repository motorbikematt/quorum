import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

vi.mock('html5-qrcode', () => ({
  Html5QrcodeScanner: vi.fn().mockImplementation(function(this: any) {
    this.render = vi.fn();
    this.clear = vi.fn().mockResolvedValue(undefined);
  }),
  Html5QrcodeScanType: { SCAN_TYPE_CAMERA: 0 },
}));

window.alert = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
