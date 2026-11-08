import { supabase } from '../supabase';
import type { User } from '../../types';

export const profileToUser = (row: Record<string, unknown>): User => ({
  id: row.id as string,
  businessName: row.business_name as string,
  email: row.email as string,
  slug: row.slug as string | undefined,
  role: row.role as 'owner' | 'staff',
  ownerId: row.owner_id as string | undefined,
  status: row.status as 'unverified' | 'verified',
  access: row.access as 'active' | 'disabled',
  tier: (row.tier as 'free' | 'pro') ?? 'free',
  tierExpiresAt: row.tier_expires_at as string | undefined,
  createdAt: row.created_at as string,
});

export type ProfileFetchResult = {
  user: User | null;
  error: string | null;
  code?: string | null;
};

export async function fetchProfileDetailed(userId: string): Promise<ProfileFetchResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    const errorCode = typeof (error as { code?: string }).code === 'string'
      ? (error as { code: string }).code
      : null;
    return { user: null, error: error.message, code: errorCode };
  }
  if (!data) return { user: null, error: null };
  return { user: profileToUser(data), error: null, code: null };
}

export async function fetchProfile(userId: string): Promise<User | null> {
  const result = await fetchProfileDetailed(userId);
  return result.user;
}

export async function fetchProfileBySlug(slug: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('slug', slug)
    .eq('role', 'owner')
    .single();
  if (error || !data) return null;
  return profileToUser(data);
}

export async function fetchStaffAccounts(businessId: string): Promise<User[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from('business_memberships')
    .select('user_id, access')
    .eq('business_id', businessId)
    .eq('role', 'staff');
  if (membershipError || !memberships?.length) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', memberships.map((membership) => membership.user_id));
  if (error || !data) return [];
  const accessByUser = new Map(memberships.map((membership) => [membership.user_id as string, membership.access as User['access']]));
  return data.map((row) => ({ ...profileToUser(row), access: accessByUser.get(row.id) ?? 'active' }));
}

export async function updateProfile(
  userId: string,
  updates: { email?: string }
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) return { ok: false, error: 'Unable to update this profile right now. Please try again.' };
  return { ok: true };
}

export async function isSlugAvailable(slug: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('is_business_slug_available', { slug_input: slug });
  if (error) return false;
  return data === true;
}
