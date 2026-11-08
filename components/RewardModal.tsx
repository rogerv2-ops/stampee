import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Loader2, PartyPopper, X } from 'lucide-react';
import { ThemeColors } from '../types';
import { resolveHexAndOpacity, hexToRgba } from '../lib/utils';
import { useI18n } from '../lib/i18n';

const LottiePlayer = lazy(() => import('lottie-react'));

const COMPLETION_MESSAGES = [
  "You've got this loyalty thing down to a science. Enjoy your genius-level reward!",
  "You came, you saw, you conquered. Claim your prize, champ!",
  "You're one sharp tack! Thanks for sticking with us-enjoy your treat.",
  "Precision pays off. You've successfully navigated your way to a free reward. Well played.",
  "Efficiency at its finest. You've maximized your stamps-now it's time to collect the dividend.",
  "You've officially figured out the secret to winning. Your reward is ready and waiting.",
  "You make this look easy. Your loyalty card is full and your reward is unlocked. Stay sharp.",
  "Sharp choice. Enjoy your well-earned treat.",
  "System hacked. You've unlocked the freebie level!",
  "Straight A's in loyalty. Class is dismissed-enjoy your reward!",
  "Flawless strategy. Your reward is officially in play.",
  "Stamps full. Logic wins. Enjoy!",
  "You've got the system down. Reward ready!",
  "Expertly earned. Here's your reward.",
  "Savvy shopper, sweet reward. It's yours!",
];

interface RewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  reward: { code: string; message: string } | null;
  rewardName: string;
  businessName: string;
  showCloseButton?: boolean;
  scope?: 'fullscreen' | 'container';
  colors: ThemeColors;
}

export const RewardModal: React.FC<RewardModalProps> = ({ isOpen, onClose, loading, reward, rewardName, businessName, showCloseButton = true, scope = 'fullscreen', colors }) => {
  const { t } = useI18n();
  const [giftAnimation, setGiftAnimation] = useState<object | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<string>(COMPLETION_MESSAGES[0]);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });

  const textColor = resolveHexAndOpacity(colors.text, '#111111');
  const mutedColor = resolveHexAndOpacity(colors.muted, '#666666');
  const cardBg = resolveHexAndOpacity(colors.cardBackground, '#ffffff');
  const iconActive = resolveHexAndOpacity(colors.iconActive, '#111111');
  const panelBg = resolveHexAndOpacity(colors.background, '#f5f5f5');
  const borderColor = resolveHexAndOpacity(colors.border, '#e5e7eb');
  const confettiColors = useMemo(
    () => ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c', '#00c2ff'],
    []
  );
  const confettiCount = isMobileViewport ? 68 : 180;
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: confettiCount }, (_, index) => ({
        id: index,
        left: (index * (isMobileViewport ? 11.1 : 7.3)) % 100,
        top: -16 - (index % (isMobileViewport ? 6 : 10)) * 3,
        size: (isMobileViewport ? 5 : 6) + (index % (isMobileViewport ? 4 : 5)),
        rotate: index * 23,
        drift: (index % 2 === 0 ? 1 : -1) * ((isMobileViewport ? 18 : 30) + (index % 7) * (isMobileViewport ? 8 : 12)),
        spin: 360 + (index % 5) * 120,
        shape: index % 3 === 0 ? 'dot' : 'bar',
        color: confettiColors[index % confettiColors.length],
      })),
    [confettiColors, confettiCount, isMobileViewport]
  );

  useEffect(() => {
    if (!isOpen || loading) return;

    const nextIndex = Math.floor(Math.random() * COMPLETION_MESSAGES.length);
    setSelectedMessage(COMPLETION_MESSAGES[nextIndex]);

    let cancelled = false;
    void import('../Gift Box Orange.json')
      .then((module) => {
        if (!cancelled) {
          setGiftAnimation(module.default);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGiftAnimation(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, loading]);

  useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 640);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!isOpen) return null;
  const isContainerScope = scope === 'container';
  const rootClassName = isContainerScope
    ? "absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-2 sm:p-3"
    : "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4";

  return (
    <div className={rootClassName}>
      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden="true">
        {confettiPieces.map((piece) => (
          <span
            key={piece.id}
            className={`reward-confetti-piece absolute ${piece.shape === 'dot' ? 'rounded-full' : 'rounded-sm'}`}
            style={
              {
                left: `${piece.left}%`,
                top: `${piece.top}%`,
                width: `${piece.size}px`,
                height: `${piece.shape === 'dot' ? piece.size : piece.size * 1.8}px`,
                backgroundColor: piece.color,
                opacity: 0.95,
                transform: `rotate(${piece.rotate}deg)`,
                animation: 'reward-confetti-fall 3s ease-out forwards',
                '--x-drift': `${piece.drift}px`,
                '--confetti-spin': `${piece.spin}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div
        className="rounded-2xl shadow-xl max-w-md w-full p-5 sm:p-6 relative z-20 overflow-hidden animate-bounce-short"
        style={{ backgroundColor: cardBg.hex, color: textColor.hex }}
      >
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 hover:opacity-70 transition-opacity"
            style={{ color: hexToRgba(mutedColor.hex, mutedColor.opacity) }}
          >
            <X size={20} />
          </button>
        )}

        <div className="relative z-10 flex flex-col items-center text-center space-y-3">
          <div className="h-32 w-32 sm:h-36 sm:w-36 flex items-center justify-center">
            {loading ? (
              <Loader2 className="animate-spin" size={44} style={{ color: iconActive.hex }} />
            ) : giftAnimation ? (
              <Suspense fallback={<PartyPopper size={56} style={{ color: iconActive.hex }} />}>
                <div className="h-32 w-32 sm:h-36 sm:w-36 overflow-visible">
                  <LottiePlayer animationData={giftAnimation} loop={true} className="h-full w-full scale-[1.55]" />
                </div>
              </Suspense>
            ) : (
              <PartyPopper size={56} style={{ color: iconActive.hex }} />
            )}
          </div>

          <h2 className="text-2xl font-bold">
            {loading ? t('Preparing Reward...') : t('Card Completed!')}
          </h2>

          {loading ? (
             <p className="opacity-70" style={{ color: hexToRgba(mutedColor.hex, mutedColor.opacity) }}>
               {t('Preparing your reward...')}
             </p>
          ) : (
            <>
              <p className="italic" style={{ color: hexToRgba(mutedColor.hex, mutedColor.opacity) }}>"{selectedMessage}"</p>

              <div
                className="w-full p-4 rounded-lg border-2 border-dashed mt-2"
                style={{ backgroundColor: panelBg.hex, borderColor: borderColor.hex }}
              >
                <p className="text-xs uppercase tracking-wider mb-1 opacity-70" style={{ color: hexToRgba(mutedColor.hex, mutedColor.opacity) }}>
                  {t('Claim Your Reward')}
                </p>
                <p className="text-2xl font-mono font-bold tracking-widest">
                  {rewardName}
                </p>
              </div>

              <p className="text-xs mt-1 opacity-50" style={{ color: hexToRgba(mutedColor.hex, mutedColor.opacity) }}>
                 {t('Show this card to the staff of')} "{businessName}".
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
