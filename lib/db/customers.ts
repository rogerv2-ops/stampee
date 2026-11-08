import { supabase } from '../supabase';
import type { Customer, IssuedCard, Transaction } from '../../types';

interface CustomerRow {
  id: string;
  business_id: string;
  owner_id: string;
  name: string;
  email: string;
  mobile: string | null;
  status: 'Active' | 'Inactive';
}

function rowToCustomer(row: CustomerRow, cards: IssuedCard[]): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    mobile: row.mobile ?? undefined,
    status: row.status,
    cards,
  };
}

export async function fetchCustomersWithCards(businessId: string): Promise<Customer[]> {
  const { data: customerRows, error: cErr } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true });
  if (cErr || !customerRows) return [];

  const customerIds = customerRows.map((c: CustomerRow) => c.id);
  if (customerIds.length === 0) return customerRows.map((r: CustomerRow) => rowToCustomer(r, []));

    const { data: cardRows, error: cardErr } = await supabase
    .from('issued_cards')
    .select('*')
    .eq('business_id', businessId)
    .in('customer_id', customerIds);

  const cards: IssuedCard[] = [];
  const cardIds: string[] = [];
  if (!cardErr && cardRows) {
    for (const r of cardRows) {
      cardIds.push(r.id);
      cards.push({
        id: r.id,
        uniqueId: r.unique_id,
        cardCode: r.card_code ?? undefined,
        campaignId: r.campaign_id ?? null,
        campaignName: r.campaign_name,
        stamps: r.stamps,
        lastVisit: r.last_visit,
        status: r.status,
        completedDate: r.completed_date ?? undefined,
        history: [],
        templateSnapshot: r.template_snapshot ?? undefined,
      });
    }
  }

  if (cardIds.length > 0) {
    const { data: txRows } = await supabase
      .from('transactions')
      .select('*')
      .eq('business_id', businessId)
      .in('card_id', cardIds)
      .order('timestamp', { ascending: true });
    if (txRows) {
      const txMap = new Map<string, Transaction[]>();
      for (const t of txRows) {
        const tx: Transaction = {
          id: t.id,
          type: t.type,
          amount: t.amount,
          date: t.date,
          timestamp: t.timestamp,
          title: t.title,
          remarks: t.remarks ?? undefined,
          actorId: t.actor_id ?? undefined,
          actorName: t.actor_name ?? undefined,
          actorRole: t.actor_role ?? undefined,
        };
        const list = txMap.get(t.card_id) ?? [];
        list.push(tx);
        txMap.set(t.card_id, list);
      }
      for (const card of cards) {
        card.history = txMap.get(card.id) ?? [];
      }
    }
  }

  const cardsByCustomer = new Map<string, IssuedCard[]>();
  for (const r of cardRows ?? []) {
    const card = cards.find((c) => c.id === r.id);
    if (card) {
      const list = cardsByCustomer.get(r.customer_id) ?? [];
      list.push(card);
      cardsByCustomer.set(r.customer_id, list);
    }
  }

  return customerRows.map((r: CustomerRow) => rowToCustomer(r, cardsByCustomer.get(r.id) ?? []));
}

export async function upsertCustomer(
  customer: { id: string; name: string; email: string; mobile?: string; status: 'Active' | 'Inactive' },
  businessId: string,
  ownerId: string
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const row = {
    id: customer.id,
    business_id: businessId,
    owner_id: ownerId,
    name: customer.name,
    email: customer.email,
    mobile: customer.mobile ?? null,
    status: customer.status,
  };
  const { error } = await supabase.from('customers').upsert(row, { onConflict: 'id' });
  if (error) return { ok: false, error: 'Unable to save this customer right now. Please try again.' };
  return { ok: true, id: customer.id };
}

export async function updateCustomerStatus(
  customerId: string,
  businessId: string,
  status: 'Active' | 'Inactive'
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('customers')
    .update({ status })
    .eq('id', customerId)
    .eq('business_id', businessId);
  if (error) return { ok: false, error: 'Unable to update this customer right now. Please try again.' };
  return { ok: true };
}
