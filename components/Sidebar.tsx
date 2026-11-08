import React from 'react';
import { LayoutDashboard, Users, CreditCard, Settings, LogOut, Wallet, History, QrCode, Crown, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { useSubscriptionContext } from './SubscriptionContext';
import { useI18n } from '../lib/i18n';

interface SidebarProps {
  className?: string;
  onScanQr?: () => void;
}

interface SidebarContentProps {
  onNavigate?: () => void;
  onScanQr?: () => void;
}

export const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner'] },
  { path: '/campaigns', label: 'Campaigns', icon: CreditCard, roles: ['owner'] },
  { path: '/issued-cards', label: 'Issued Cards', icon: Wallet, roles: ['owner', 'staff'] },
  { path: '/transactions', label: 'Transactions', icon: History, roles: ['owner'] },
  { path: '/customers', label: 'Customers', icon: Users, roles: ['owner', 'staff'] },
  { path: '/analytics', label: 'Analytics', icon: Sparkles, roles: ['owner'] },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['owner'] },
];

const PlanBadge: React.FC = () => {
  const {
    isProTier,
    campaignCount,
    campaignLimit,
    issuedCardCount,
    cardLimit,
  } = useSubscriptionContext();
  const { isStaff } = useAuth();
  const { t } = useI18n();
  if (isStaff) return null;

  if (isProTier) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 px-3 py-2 text-xs">
        <Crown size={14} className="text-amber-500" />
        <span className="font-semibold text-amber-700">{t("Pro Plan")}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5 text-xs space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground">{t("Beta Plan")}</span>
        <Sparkles size={12} className="text-muted-foreground" />
      </div>
      <div className="flex items-center gap-3 text-muted-foreground">
        <span>{campaignCount}/{campaignLimit === Infinity ? '∞' : campaignLimit} {t('campaigns')}</span>
        <span className="text-border">|</span>
        <span>{issuedCardCount}/{cardLimit === Infinity ? '∞' : cardLimit} {t('cards')}</span>
      </div>
    </div>
  );
};

export const SidebarContent: React.FC<SidebarContentProps> = ({ onNavigate, onScanQr }) => {
  const navigate = useNavigate();
  const { currentUser, currentOwner, businesses, activeBusiness, switchBusiness, isStaff, logout } = useAuth();
  const { t } = useI18n();

  return (
    <div className="flex h-full flex-col py-8">
      <div className="px-3 py-2">
        <div className="mb-6 px-4 flex items-center gap-3">
          <Link to="/" className="inline-flex items-center" onClick={onNavigate}>
            <img
              src="/stampee.svg"
              alt={t("Stampee logo")}
              className="h-12 w-auto"
            />
          </Link>
        </div>
        <div className="space-y-2">
          {!isStaff && businesses.length > 0 && (
            <div className="mb-4 rounded-xl border border-border/80 bg-background p-2">
              <label className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Business")}</label>
              <select value={activeBusiness?.id ?? ''} onChange={(event) => switchBusiness(event.target.value)} className="mt-1 w-full rounded-lg border-0 bg-transparent px-2 py-2 text-sm font-medium outline-none">
                {businesses.map((business) => <option key={business.id} value={business.id}>{business.businessName}</option>)}
              </select>
              <Link to="/businesses" onClick={onNavigate} className="block px-2 pb-1 text-xs text-muted-foreground hover:text-foreground">{t("Manage businesses")}</Link>
            </div>
          )}
          {NAV_ITEMS.filter((item) => item.roles.includes(isStaff ? 'staff' : 'owner')).map((item) => (
            <NavLink to={item.path} key={item.path} onClick={onNavigate}>
              {({ isActive }) => (
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2"
                >
                  <item.icon size={20} />
                  {t(item.label)}
                </Button>
              )}
            </NavLink>
          ))}
          {isStaff && (
            <Button
              variant="default"
              className="w-full justify-start gap-2 mt-2"
              onClick={() => {
                onScanQr?.();
                onNavigate?.();
              }}
            >
              <QrCode size={20} />
              {t("Scan QR Code")}
            </Button>
          )}
        </div>
      </div>
      <div className="mt-auto px-4 pt-6 space-y-3">
         <PlanBadge />
         {currentUser && (
          <div className="rounded-lg border border-border/80 bg-card px-3 py-3 text-xs text-muted-foreground shadow-subtle">
              <div className="font-semibold text-foreground">{activeBusiness?.businessName ?? currentUser.businessName}</div>
              <div className="font-mono">@{activeBusiness?.slug ?? currentOwner?.slug ?? "staff"}</div>
              {isStaff && <div className="text-[10px] uppercase tracking-widest mt-1">{t("Staff Access")}</div>}
          </div>
         )}
         <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
         >
            <LogOut size={20} />
            {t("Log Out")}
         </Button>
         <div className="px-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            v0.5
         </div>
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ className, onScanQr }) => {
  return (
    <div className={cn("hidden h-screen w-72 border-r border-border/80 bg-card md:block", className)}>
      <SidebarContent onScanQr={onScanQr} />
    </div>
  );
};
