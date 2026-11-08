import { supabase } from '../supabase';
import type { StoredTemplate } from '../../types';

interface CampaignRow {
  id: string;
  business_id: string;
  owner_id: string;
  name: string;
  is_enabled: boolean;
  description: string;
  reward_name: string;
  tagline: string | null;
  background_image: string | null;
  background_opacity: number;
  logo_image: string | null;
  show_logo: boolean;
  title_size: string | null;
  icon_key: string;
  colors: Record<string, string>;
  total_stamps: number;
  social: Record<string, string> | null;
}

export function rowToStoredTemplate(row: CampaignRow): StoredTemplate {
  return {
    id: row.id,
    name: row.name,
    isEnabled: row.is_enabled,
    description: row.description,
    rewardName: row.reward_name,
    tagline: row.tagline ?? undefined,
    backgroundImage: row.background_image ?? undefined,
    backgroundOpacity: row.background_opacity,
    logoImage: row.logo_image ?? undefined,
    showLogo: row.show_logo,
    titleSize: row.title_size ?? undefined,
    iconKey: row.icon_key,
    colors: row.colors as unknown as StoredTemplate['colors'],
    totalStamps: row.total_stamps,
    social: row.social as StoredTemplate['social'],
  };
}

function templateToRow(template: StoredTemplate, businessId: string, ownerId: string) {
  return {
    id: template.id,
    business_id: businessId,
    owner_id: ownerId,
    name: template.name,
    is_enabled: template.isEnabled ?? true,
    description: template.description,
    reward_name: template.rewardName,
    tagline: template.tagline ?? null,
    background_image: template.backgroundImage ?? null,
    background_opacity: template.backgroundOpacity ?? 100,
    logo_image: template.logoImage ?? null,
    show_logo: template.showLogo ?? true,
    title_size: template.titleSize ?? null,
    icon_key: template.iconKey,
    colors: template.colors,
    total_stamps: template.totalStamps,
    social: template.social ?? null,
  };
}

export async function fetchCampaigns(businessId: string): Promise<StoredTemplate[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((row: CampaignRow) => rowToStoredTemplate(row));
}

export async function upsertCampaign(
  template: StoredTemplate,
  businessId: string,
  ownerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('campaigns')
    .upsert(templateToRow(template, businessId, ownerId), { onConflict: 'id' });
  if (error) return { ok: false, error: 'Unable to save this campaign right now. Please try again.' };
  return { ok: true };
}

export async function setCampaignEnabled(
  campaignId: string,
  businessId: string,
  isEnabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('campaigns')
    .update({ is_enabled: isEnabled })
    .eq('id', campaignId)
    .eq('business_id', businessId);
  if (error) return { ok: false, error: 'Unable to update this campaign status right now. Please try again.' };
  return { ok: true };
}

export async function deleteCampaign(
  campaignId: string,
  businessId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('delete_campaign_preserve_cards', {
    campaign_id_input: campaignId,
    business_id_input: businessId,
  });
  if (error) return { ok: false, error: 'Unable to delete this campaign right now. Please try again.' };
  if (typeof data === 'object' && data && 'success' in data && (data as { success?: boolean }).success === false) {
    return { ok: false, error: 'Unable to delete this campaign right now. Please try again.' };
  }
  return { ok: true };
}

export async function countCampaigns(businessId: string): Promise<number> {
  const { count, error } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId);
  return error ? 0 : count ?? 0;
}
