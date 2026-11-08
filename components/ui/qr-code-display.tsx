import QRCode from 'react-qr-code';
import { cn } from '../../lib/utils';
import { useI18n } from '../../lib/i18n';

interface QrCodeDisplayProps {
  value: string;
  className?: string;
  label?: string;
}

export function QrCodeDisplay({ value, className, label = 'QR code' }: QrCodeDisplayProps) {
  const { t } = useI18n();
  return (
    <div aria-label={t(label)} className={cn("inline-flex aspect-square", className)} role="img">
      <QRCode
        value={value}
        bgColor="#FFFFFF"
        fgColor="#111111"
        level="M"
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
}
