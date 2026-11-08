import { supabase } from '../supabase';
import type { Business, User } from '../../types';

const rowToBusiness = (row: Record<string, unknown>): Business => ({
  id: row.id as string,
  ownerUserId: row.owner_user_id as string,
  businessName: row.business_name as string,
  slug: row.slug as string,
  status: row.status === 'verified' ? 'active' : row.status === 'unverified' ? 'pending' : (row.status as Business['status']) ?? 'pending',
  access: (row.access as Business['access']) ?? 'active',
  tier: (row.tier as Business['tier']) ?? 'free',
  tierExpiresAt: row.tier_expires_at as string | undefined,
  createdAt: row.created_at as string,
});

export async function fetchBusinesses(user: User): Promise<Business[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from('business_memberships')
    .select('business_id, role, access')
    .eq('user_id', user.id)
    .eq('access', 'active');
  if (membershipError || !memberships?.length) return [];
  const ids = memberships.map((membership) => membership.business_id as string);
  const { data, error } = await supabase.from('businesses').select('*').in('id', ids).order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((row) => rowToBusiness(row as Record<string, unknown>));
}

export async function createBusiness(businessName: string, slug: string): Promise<{ business: Business | null; error?: string }> {
  const { data, error } = await supabase.rpc('create_business', {
    business_name_input: businessName.trim(),
    slug_input: slug.trim(),
  });
  if (error || !data) return { business: null, error: 'Unable to create this business right now. Please try again.' };
  const id = typeof data === 'string' ? data : (data as { id?: string }).id;
  if (!id) return { business: null, error: 'Unable to create this business right now. Please try again.' };
  const { data: row, error: fetchError } = await supabase.from('businesses').select('*').eq('id', id).maybeSingle();
  if (fetchError || !row) return { business: null, error: 'Business created, but could not be loaded. Please refresh and try again.' };
  return { business: rowToBusiness(row as Record<string, unknown>) };
}

export async function isBusinessSlugAvailable(slug: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_business_slug_available', { slug_input: slug });
  if (error) throw error;
  return data === true;
}
