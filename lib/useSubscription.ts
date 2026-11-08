import { useMemo } from 'react';
import { Customer, Template, SubscriptionTier } from '../types';
import { useAuth } from '../components/AuthProvider';

interface SubscriptionInfo {
  tier: SubscriptionTier;
  isProTier: boolean;
  campaignCount: number;
  issuedCardCount: number;
  staffCount: number;
  campaignLimit: number;
  cardLimit: number;
  staffLimit: number;
  canCreateCampaign: boolean;
  canIssueCard: boolean;
  canCreateStaff: boolean;
}

export function useSubscription(campaigns: Template[], customers: Customer[]): SubscriptionInfo {
  const { activeBusiness, staffAccounts } = useAuth();

  return useMemo(() => {
    const tier: SubscriptionTier = activeBusiness?.tier ?? 'free';
    const campaignCount = campaigns.length;
    const issuedCardCount = customers.reduce((sum, c) => sum + c.cards.length, 0);
    const staffCount = staffAccounts.length;

    return {
      tier,
      isProTier: tier === 'pro',
      campaignCount,
      issuedCardCount,
      staffCount,
      campaignLimit: Infinity,
      cardLimit: Infinity,
      staffLimit: Infinity,
      canCreateCampaign: true,
      canIssueCard: true,
      canCreateStaff: true,
    };
  }, [activeBusiness?.tier, campaigns, customers, staffAccounts]);
}
