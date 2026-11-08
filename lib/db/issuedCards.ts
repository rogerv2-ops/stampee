import { supabase } from '../supabase';
import type { IssuedCard, Transaction, StoredTemplate } from '../../types';

export type ScannedCardStatus = 'owned' | 'foreign' | 'missing';

export interface PublicScanEntryContext {
  owner: {
    id: string;
    ownerUserId: string;
    slug: string;
    businessName: string;
  };
  card: {
    uniqueId: string;
    cardCode?: string;
  };
}

export interface ResolvedStaffCardReference {
  uniqueId: string;
  cardCode: string;
}

export async function insertIssuedCard(
  card: {
    id: string;
    uniqueId: string;
    customerId: string;
    campaignId: string;
    campaignName: string;
    templateSnapshot?: StoredTemplate;
  },
  businessId: string,
  ownerId: string
): Promise<{ ok: boolean; cardCode?: string; error?: string }> {
  const { data, error } = await supabase.from('issued_cards').insert({
    id: card.id,
    unique_id: card.uniqueId,
    customer_id: card.customerId,
    campaign_id: card.campaignId,
    business_id: businessId,
    owner_id: ownerId,
    campaign_name: card.campaignName,
    stamps: 0,
    last_visit: new Date().toISOString().split('T')[0],
    status: 'Active',
    template_snapshot: card.templateSnapshot ?? null,
  }).select('card_code').single();
  if (error) {
    if (error.message.includes('CAMPAIGN_DISABLED')) {
      return { ok: false, error: 'This campaign is disabled and cannot issue new cards.' };
    }
    return { ok: false, error: 'Unable to issue this card right now. Please try again.' };
  }
  if (!data?.card_code) return { ok: false, error: 'Unable to assign a card code. Please try again.' };
  return { ok: true, cardCode: data.card_code };
}

export async function updateIssuedCard(
  cardId: string,
  businessId: string,
  updates: Partial<Pick<IssuedCard, 'stamps' | 'status' | 'completedDate' | 'lastVisit'>>
): Promise<{ ok: boolean; error?: string }> {
  const row: Record<string, unknown> = {};
  if (updates.stamps !== undefined) row.stamps = updates.stamps;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.completedDate !== undefined) row.completed_date = updates.completedDate;
  if (updates.lastVisit !== undefined) row.last_visit = updates.lastVisit;

  const { error } = await supabase
    .from('issued_cards')
    .update(row)
    .eq('id', cardId)
    .eq('business_id', businessId);
  if (error) return { ok: false, error: 'Unable to update this card right now. Please try again.' };
  return { ok: true };
}

export async function deleteIssuedCard(cardId: string, businessId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('issued_cards')
    .delete()
    .eq('id', cardId)
    .eq('business_id', businessId);
  if (error) return { ok: false, error: 'Unable to revoke this card right now. Please try again.' };
  return { ok: true };
}

export async function insertTransaction(
  cardId: string,
  tx: Transaction,
  businessId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('transactions').insert({
    id: tx.id,
    card_id: cardId,
    business_id: businessId,
    type: tx.type,
    amount: tx.amount,
    date: tx.date,
    timestamp: tx.timestamp,
    title: tx.title,
    remarks: tx.remarks ?? null,
    actor_id: tx.actorId ?? null,
    actor_name: tx.actorName ?? null,
    actor_role: tx.actorRole ?? null,
  });
  if (error) return { ok: false, error: 'Unable to save this activity right now. Please try again.' };
  return { ok: true };
}

export async function countIssuedCards(businessId: string): Promise<number> {
  const { count, error } = await supabase
    .from('issued_cards')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId);
  if (error) return 0;
  return count ?? 0;
}

export async function inspectScannedCard(uniqueId: string): Promise<{ status: ScannedCardStatus; error?: string }> {
  const { data, error } = await supabase.rpc('inspect_scanned_card', {
    card_unique_id: uniqueId,
  });
  if (error) {
    return { status: 'missing', error: 'Unable to validate this card right now. Please try again.' };
  }

  const status = typeof data === 'object' && data && 'status' in data
    ? (data as { status?: string }).status
    : undefined;

  if (status === 'owned' || status === 'foreign' || status === 'missing') {
    return { status };
  }

  return { status: 'missing' };
}

export async function resolveStaffCardCode(
  businessId: string,
  cardCode: string
): Promise<ResolvedStaffCardReference | null> {
  const { data, error } = await supabase.rpc('resolve_staff_card_code', {
    business_id_input: businessId,
    card_code_input: cardCode,
  });
  if (error || !data || typeof data !== 'object') return null;
  const payload = data as { uniqueId?: string; cardCode?: string; unique_id?: string; card_code?: string };
  const uniqueId = payload.uniqueId ?? payload.unique_id;
  const resolvedCode = payload.cardCode ?? payload.card_code;
  if (!uniqueId || !resolvedCode) return null;
  return { uniqueId, cardCode: resolvedCode };
}

export async function fetchPublicScanEntryContext(
  slug: string,
  uniqueId: string
): Promise<PublicScanEntryContext | null> {
  const { data, error } = await supabase.rpc('get_scan_entry_context', {
    slug_input: slug,
    card_unique_id: uniqueId,
  });
  if (error || !data || typeof data !== 'object') {
    return null;
  }

  const payload = data as {
    owner?: { id?: string; ownerUserId?: string; slug?: string; businessName?: string };
    card?: { uniqueId?: string; cardCode?: string; unique_id?: string; card_code?: string };
  };

  if (!payload.owner?.id || !payload.owner.ownerUserId || !payload.owner.slug || !payload.card?.uniqueId) {
    return null;
  }

  return {
    owner: {
      id: payload.owner.id,
      ownerUserId: payload.owner.ownerUserId,
      slug: payload.owner.slug,
      businessName: payload.owner.businessName ?? '',
    },
    card: {
      uniqueId: payload.card.uniqueId,
      cardCode: payload.card.cardCode ?? payload.card.card_code ?? '',
    },
  };
}
