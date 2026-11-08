import React, { useState } from 'react';
import { Building2, Plus, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { normalizeSlug, isSlugValid } from '../lib/slug';

export const BusinessHubPage: React.FC = () => {
  const navigate = useNavigate();
  const { businesses, activeBusiness, switchBusiness, createBusiness, isSlugAvailable } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const openBusiness = (id: string) => { switchBusiness(id); navigate('/dashboard'); };
  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const nextSlug = normalizeSlug(slug);
    if (!name.trim() || !isSlugValid(nextSlug)) { setError('Enter a business name and a valid slug.'); return; }
    setBusy(true);
    try {
      if (!(await isSlugAvailable(nextSlug))) { setError('That slug is already in use.'); return; }
      const result = await createBusiness({ businessName: name, slug: nextSlug });
      if (!result.ok) { setError(result.error); return; }
      setName(''); setSlug(''); setOpen(false);
    } catch { setError('Unable to validate or create this business right now. Please try again.'); }
    finally { setBusy(false); }
  };
  return <div className="h-full overflow-y-auto bg-gray-50/50 p-4 md:p-8">
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-muted-foreground">Workspace hub</p><h1 className="text-3xl font-bold">Your businesses</h1><p className="mt-1 text-muted-foreground">Each business has its own campaigns, customers, team, and public links.</p></div><Button onClick={() => setOpen((value) => !value)}><Plus size={16} /> Create business</Button></div>
      {open && <form onSubmit={handleCreate} className="rounded-2xl border bg-white p-5 shadow-sm space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><Label>Business name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div><div><Label>Public slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-business" required /></div></div>{error && <p className="text-sm text-rose-600">{error}</p>}<Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create business'}</Button></form>}
      {businesses.length === 0 ? <div className="rounded-2xl border border-dashed bg-white p-10 text-center"><Building2 className="mx-auto mb-3 text-muted-foreground" /><p className="text-muted-foreground">No businesses are available for this account.</p></div> : <div className="grid gap-4 md:grid-cols-2">{businesses.map((business) => <div key={business.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div className="flex gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Building2 size={22} /></div><div><h2 className="font-semibold">{business.businessName}</h2><p className="font-mono text-xs text-muted-foreground">@{business.slug}</p></div></div>{activeBusiness?.id === business.id && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Active</span>}</div><Button variant="outline" className="mt-6 w-full" onClick={() => openBusiness(business.id)}>Open workspace <ArrowRight size={16} /></Button></div>)}</div>}
    </div>
  </div>;
};
