declare module 'qrcode' {
  export interface QRCodeOptions {
    version?: number;
    errorCorrectionLevel?: 'low' | 'medium' | 'quartile' | 'high';
    margin?: number;
    width?: number;
    scale?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export function toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
  export function toDataURL(text: string, callback: (err: Error | null, url: string) => void): void;
  export function toDataURL(text: string, options: QRCodeOptions, callback: (err: Error | null, url: string) => void): void;
}
