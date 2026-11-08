import type { ComponentType, SVGProps } from 'react';

export type IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    className?: string;
  }
>;

export interface ThemeColors {
  background: string;
  cardBackground: string;
  text: string;
  muted: string;
  stampActive: string;
  stampInactive: string;
  iconActive: string;
  iconInactive: string;
  button: string;
  buttonText: string;
  border: string;
}

export interface Template {
  id: string;
  name: string;
  isEnabled?: boolean;
  description: string;
  rewardName: string;
  tagline?: string; // Custom instruction text e.g. "Buy 10 get 1 free"
  backgroundImage?: string; // URL for background
  backgroundOpacity?: number; // 0-100
  logoImage?: string; // URL for custom brand logo
  showLogo?: boolean; // Toggle for main logo visibility
  titleSize?: string; // Optional custom font size class for the title
  icon: IconComponent;
  colors: ThemeColors;
  totalStamps: number;
  social?: SocialLinks;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  x?: string;
  youtube?: string;
  website?: string;
}

export type StoredTemplate = Omit<Template, 'icon'> & {
  iconKey: string;
};

export interface Transaction {
  id: string;
  type: 'stamp_add' | 'stamp_remove' | 'redeem' | 'issued';
  amount: number;
  date: string; // Formatted string for display
  timestamp: number; // For sorting
  title: string;
  remarks?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: UserRole;
}

export interface IssuedCard {
  id: string; // Internal ID
  uniqueId: string; // Public UUID for link
  cardCode?: string; // Human-facing database-assigned reference code
  campaignId: string | null;
  campaignName: string;
  stamps: number;
  lastVisit: string;
  status: 'Active' | 'Redeemed'; // New status field
  completedDate?: string; // Date when redeemed
  history: Transaction[]; // Log of all actions
  templateSnapshot?: StoredTemplate; // Campaign design at issue time
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  status: 'Active' | 'Inactive';
  cards: IssuedCard[];
}

// Internal account state. Email confirmation now comes from Supabase auth.
export type AccountStatus = 'unverified' | 'verified';
export type UserRole = 'owner' | 'staff';
export type AccessStatus = 'active' | 'disabled';
export type SubscriptionTier = 'free' | 'pro';
export interface Business {
  id: string;
  ownerUserId: string;
  businessName: string;
  slug: string;
  status: 'active' | 'pending' | 'disabled';
  access: AccessStatus;
  tier: SubscriptionTier;
  tierExpiresAt?: string;
  createdAt: string;
}

export const TIER_LIMITS = {
  free: { campaigns: Infinity, issuedCards: Infinity, staff: Infinity },
  pro: { campaigns: Infinity, issuedCards: Infinity, staff: Infinity },
} as const;

export interface User {
  id: string;
  businessName: string;
  email: string;
  slug?: string;
  role: UserRole;
  ownerId?: string;
  status: AccountStatus;
  access: AccessStatus;
  tier: SubscriptionTier;
  tierExpiresAt?: string;
  createdAt: string;
}
