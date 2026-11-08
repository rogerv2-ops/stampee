import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "./ui/table";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Plus, Search, CreditCard, MonitorPlay, MoreHorizontal, Trash, ExternalLink, Lock, QrCode
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "../lib/utils";
import { Customer, Template, IssuedCard, Transaction } from '../types';
import { KioskMode } from './KioskMode';
import { IssueCardDialog } from './IssueCardDialog';
import { resolveCardTemplate, toStoredTemplate } from '../lib/templateSerialization';
import { useAuth } from './AuthProvider';
import { buildPublicCardUrl } from '../lib/links';
import { ScanDetectionResult, ScanQrDialog } from './ScanQrDialog';
import { insertIssuedCard, updateIssuedCard, deleteIssuedCard, insertTransaction, inspectScannedCard } from '../lib/db/issuedCards';
import { upsertCustomer } from '../lib/db/customers';
import { useSubscriptionContext } from './SubscriptionContext';

interface IssuedCardsPageProps {
  customers: Customer[];
  campaigns: Template[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  refreshData?: () => Promise<void>;
  dataReady?: boolean;
}

export const IssuedCardsPage: React.FC<IssuedCardsPageProps> = ({ customers, campaigns, setCustomers, refreshData, dataReady = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const { currentOwner, activeBusiness, isEmailVerified, isStaff, currentUser } = useAuth();
  useSubscriptionContext();
  const canIssue = isEmailVerified;
  const [mutationBusy, setMutationBusy] = useState(false);
  const [mutationError, setMutationError] = useState("");

  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [activeKioskData, setActiveKioskData] = useState<{ customer: Customer, card: IssuedCard, template: Template } | null>(null);
  const [isScanOpen, setIsScanOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsScanOpen(true);
    window.addEventListener('open-qr-scan', handler);
    return () => window.removeEventListener('open-qr-scan', handler);
  }, []);

  const [preSelectedCampaign, setPreSelectedCampaign] = useState<Template | null>(null);
  const [preSelectedCustomer, setPreSelectedCustomer] = useState<Customer | null>(null);

  const findKioskMatch = useCallback((cardId: string) => {
    for (const customer of customers) {
      const found = customer.cards.find((card) => card.uniqueId === cardId);
      if (!found) continue;
      const template = resolveCardTemplate(found, campaigns);
      if (!template) return null;
      return { customer, card: found, template };
    }
    return null;
  }, [campaigns, customers]);

  const handleUpdateCard = async (customerId: string, cardId: string, updates: Partial<IssuedCard>) => {
    if (!activeBusiness) {
      setMutationError("Select a business before updating this card.");
      return;
    }
    setMutationBusy(true);
    setMutationError("");
    const dbUpdates: Parameters<typeof updateIssuedCard>[2] = {};
    if (updates.stamps !== undefined) dbUpdates.stamps = updates.stamps;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.completedDate !== undefined) dbUpdates.completedDate = updates.completedDate;
    if (updates.lastVisit !== undefined) dbUpdates.lastVisit = updates.lastVisit;

    let wroteData = false;
    try {
      if (Object.keys(dbUpdates).length > 0) {
        const updateResult = await updateIssuedCard(cardId, activeBusiness.id, dbUpdates);
        if (!updateResult.ok) {
          throw new Error(updateResult.error ?? "Failed to update the card.");
        }
        wroteData = true;
      }

      if (updates.history) {
        const existingCard = customers
          .find(c => c.id === customerId)?.cards
          .find(c => c.id === cardId);
        const existingIds = new Set((existingCard?.history ?? []).map(t => t.id));
        const newTxs = updates.history.filter(t => !existingIds.has(t.id));
        for (const tx of newTxs) {
          const txResult = await insertTransaction(cardId, tx, activeBusiness.id);
          if (!txResult.ok) {
            throw new Error(txResult.error ?? "Failed to record the card activity.");
          }
          wroteData = true;
        }
      }

      setCustomers(prev => prev.map(c => {
        if (c.id === customerId) {
          return {
            ...c,
            cards: c.cards.map(card => card.id === cardId ? { ...card, ...updates } : card)
          };
        }
        return c;
      }));

      if (activeKioskData && activeKioskData.customer.id === customerId) {
        setActiveKioskData(prev => {
          if (!prev) return null;
          return { ...prev, card: { ...prev.card, ...updates } };
        });
      }
    } catch (error) {
      if (wroteData) {
        await refreshData?.();
      }
      setMutationError("Unable to update this card right now. Please try again.");
      throw error;
    } finally {
      setMutationBusy(false);
    }
  };

  const handleRevokeCard = async (customerId: string, cardId: string) => {
    if (!activeBusiness) {
      setMutationError("Select a business before revoking this card.");
      return;
    }
    if (confirm("Are you sure you want to revoke this card? This cannot be undone.")) {
      setMutationBusy(true);
      setMutationError("");
      try {
        const result = await deleteIssuedCard(cardId, activeBusiness.id);
        if (!result.ok) {
          throw new Error(result.error ?? "Failed to revoke the card.");
        }
        setCustomers(prev => prev.map(c => {
          if (c.id === customerId) {
            return { ...c, cards: c.cards.filter(card => card.id !== cardId) };
          }
          return c;
        }));
      } catch (error) {
        setMutationError("Unable to revoke this card right now. Please try again.");
      } finally {
        setMutationBusy(false);
      }
    }
  };

  const handleKioskIssueNew = (customer: Customer, template: Template) => {
    if (!canIssue) return;
    if (template.isEnabled === false) {
      setMutationError("This campaign is disabled and cannot issue new cards.");
      return;
    }
    setPreSelectedCampaign(template);
    setPreSelectedCustomer(customer);
    setIsIssueOpen(true);
  };

  const openIssueWizard = () => {
    if (!canIssue) return;
    setPreSelectedCampaign(null);
    setPreSelectedCustomer(null);
    setIsIssueOpen(true);
  };

  const handleIssueCard = async (campaign: Template, customer: Customer | null, newCustomerData: { name: string, email: string, mobile: string }): Promise<IssuedCard> => {
    if (!currentOwner) {
      throw new Error("You must be signed in as an owner or staff member to issue cards.");
    }
    if (campaign.isEnabled === false) {
      throw new Error("This campaign is disabled and cannot issue new cards.");
    }

    const actorName = currentUser?.businessName ?? "Owner";
    const actorRole = currentUser?.role ?? "owner";
    const actorId = currentUser?.id;

    let targetCustomer = customer;

    if (!targetCustomer) {
      const newId = `cust-${Date.now()}`;
      targetCustomer = {
        id: newId,
        name: newCustomerData.name,
        email: newCustomerData.email,
        mobile: newCustomerData.mobile,
        status: "Active",
        cards: []
      };
      const customerResult = await upsertCustomer(
        { id: newId, name: newCustomerData.name, email: newCustomerData.email, mobile: newCustomerData.mobile, status: 'Active' },
        activeBusiness.id, currentOwner.id
      );
      if (!customerResult.ok) {
        throw new Error(customerResult.error ?? "Failed to create the customer record.");
      }
    }

    const now = new Date();
    const initialTransaction: Transaction = {
      id: `tx-init-${Date.now()}`,
      type: 'issued',
      amount: 0,
      date: now.toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
      }),
      timestamp: now.getTime(),
      title: "Card Issued",
      actorName,
      actorRole,
      actorId
    };

    const newCard: IssuedCard = {
      id: `card-${Date.now()}`,
      uniqueId: crypto.randomUUID(),
      campaignId: campaign.id,
      campaignName: campaign.name,
      stamps: 0,
      lastVisit: new Date().toISOString().split('T')[0],
      status: 'Active',
      history: [initialTransaction],
      templateSnapshot: toStoredTemplate(campaign)
    };

    const cardResult = await insertIssuedCard({
      id: newCard.id,
      uniqueId: newCard.uniqueId,
      customerId: targetCustomer.id,
      campaignId: campaign.id,
      campaignName: campaign.name,
      templateSnapshot: toStoredTemplate(campaign),
    }, activeBusiness.id, currentOwner.id);
    if (!cardResult.ok) {
      throw new Error(cardResult.error ?? "Failed to create the card.");
    }

    const txResult = await insertTransaction(newCard.id, initialTransaction, activeBusiness.id);
    if (!txResult.ok) {
      throw new Error(txResult.error ?? "Failed to record the initial transaction.");
    }

    const targetId = targetCustomer.id;
    const customerToAdd = targetCustomer;

    setCustomers(prev => {
      const exists = prev.find(c => c.id === targetId);
      if (exists) {
        return prev.map(c => c.id === targetId
          ? { ...c, cards: [...c.cards, newCard] }
          : c
        );
      } else {
        return [...prev, { ...customerToAdd, cards: [newCard] }];
      }
    });

    return newCard;
  };

  const extractCardId = (value: string) => {
    let raw = value.trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      const parts = url.pathname.split('/').filter(Boolean);
      raw = parts[parts.length - 1] ?? raw;
    } catch {
      // not a URL
    }
    raw = raw.replace(/^#/, '');
    raw = raw.replace(/\/+$/, '');
    const segments = raw.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? raw;
  };

  const clearKioskQuery = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('kiosk');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    const kioskId = searchParams.get('kiosk');
    if (!kioskId || !dataReady || activeKioskData) return;

    const match = findKioskMatch(kioskId);
    clearKioskQuery();

    if (!match) {
      setMutationError("Card not found. Try scanning again.");
      return;
    }

    setMutationError("");
    setActiveKioskData(match);
  }, [activeKioskData, clearKioskQuery, dataReady, findKioskMatch, searchParams]);

  const handleScanResult = useCallback(async (value: string): Promise<ScanDetectionResult> => {
    const cardId = extractCardId(value);
    if (!cardId) {
      return { ok: false, message: "QR code is invalid. Try scanning again." };
    }

    const match = findKioskMatch(cardId);
    if (match) {
      setMutationError("");
      setActiveKioskData(match);
      return { ok: true };
    }

    const inspection = await inspectScannedCard(cardId);
    if (inspection.status === 'foreign') {
      return { ok: false, message: "This card is not part of your business." };
    }

    if (inspection.status === 'owned') {
      if (refreshData) {
        await refreshData();
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('kiosk', cardId);
        return next;
      }, { replace: true });
      return { ok: true };
    }

    return { ok: false, message: "Card not found. Try scanning again." };
  }, [findKioskMatch, refreshData, setSearchParams]);

  const flatList = customers.flatMap(c => c.cards.map(card => ({ customer: c, card })));

  const sortedList = flatList.sort((a, b) => {
    if (a.card.status === 'Active' && b.card.status === 'Redeemed') return -1;
    if (a.card.status === 'Redeemed' && b.card.status === 'Active') return 1;
    return 0;
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredList = sortedList.filter(({ customer, card }) =>
    (customer.name || "").toLowerCase().includes(normalizedQuery) ||
    (customer.email || "").toLowerCase().includes(normalizedQuery) ||
    (customer.mobile || "").toLowerCase().includes(normalizedQuery) ||
    (card.campaignName || "").toLowerCase().includes(normalizedQuery) ||
    (card.uniqueId || "").toLowerCase().includes(normalizedQuery) ||
    (card.id || "").toLowerCase().includes(normalizedQuery)
  );

  const cardRows = filteredList
    .map(({ customer, card }) => {
      const campaign = resolveCardTemplate(card, campaigns);
      if (!campaign) return null;

      const progress = (card.stamps / campaign.totalStamps) * 100;
      const canRedeem = card.stamps >= campaign.totalStamps;
      const isRedeemed = card.status === 'Redeemed';
      const isArchivedCampaign = card.campaignId === null;

      return {
        customer,
        card,
        campaign,
        progress,
        canRedeem,
        isRedeemed,
        isArchivedCampaign,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const openPublicLink = (uniqueId: string) => {
    const slug = activeBusiness?.slug;
    if (!slug) return;
    window.open(buildPublicCardUrl(slug, uniqueId), '_blank');
  };

  return (
    <div className="min-h-full space-y-6 bg-gray-50/50 p-4 md:h-full md:overflow-y-auto md:p-8">

      {activeKioskData && (
        <KioskMode
          customer={activeKioskData.customer}
          card={activeKioskData.card}
          template={activeKioskData.template}
          onClose={() => setActiveKioskData(null)}
          onUpdateCard={handleUpdateCard}
          onIssueNew={handleKioskIssueNew}
          canIssue={canIssue}
          allowRedeem={true}
          actorName={currentUser?.businessName ?? "Owner"}
          actorRole={currentUser?.role ?? "owner"}
          actorId={currentUser?.id}
          onScanRequest={() => setIsScanOpen(true)}
          mutationBusy={mutationBusy}
        />
      )}

      <IssueCardDialog
        isOpen={isIssueOpen}
        onClose={() => setIsIssueOpen(false)}
        campaigns={campaigns}
        customers={customers}
        onIssue={handleIssueCard}
        preSelectedCampaign={preSelectedCampaign}
        preSelectedCustomer={preSelectedCustomer}
      />

      <ScanQrDialog
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        onDetected={handleScanResult}
      />

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Issued Cards</h1>
          <p className="text-sm text-muted-foreground md:text-base">Monitor active cards and open Kiosk Mode for stamping.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
          <Button variant="outline" className="w-full gap-2 rounded-full sm:w-auto" onClick={() => setIsScanOpen(true)}>
            <QrCode size={16} /> Scan QR
          </Button>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <Button onClick={openIssueWizard} className="w-full gap-2 rounded-full px-6 shadow-sm sm:w-auto" disabled={!canIssue}>
              <Plus size={16} /> Issue New Card
            </Button>
            {!canIssue && (
              <div className="flex items-center gap-2 text-xs text-amber-600 sm:justify-end">
                <Lock size={12} /> Confirm your email to issue cards.
              </div>
            )}
          </div>
        </div>
      </div>

      {mutationError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {mutationError}
        </div>
      )}

      <div className="flex w-full items-center space-x-2 rounded-lg border bg-white px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring sm:max-w-sm">
        <Search className="text-gray-400" size={20} />
        <input
          className="flex-1 outline-none text-sm bg-transparent placeholder:text-muted-foreground"
          placeholder="Find a card..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="rounded-xl border bg-white shadow-sm">
        {cardRows.length === 0 ? (
          <div className="flex h-32 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            No cards found. Issue one to get started.
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {cardRows.map(({ customer, card, campaign, progress, canRedeem, isRedeemed, isArchivedCampaign }) => (
                <div
                  key={card.id}
                  className={cn(
                    "rounded-2xl border p-4 shadow-sm",
                    isRedeemed ? "border-gray-200 bg-gray-50/70" : "border-border bg-white"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                        isRedeemed ? "bg-gray-100 text-gray-400" : "bg-primary/10 text-primary"
                      )}>
                        {isRedeemed ? <Lock size={18} /> : <CreditCard size={20} />}
                      </div>
                      <div className={cn("min-w-0", isRedeemed && "opacity-60")}>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm font-semibold text-foreground">{card.campaignName}</h2>
                          {isArchivedCampaign && <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Archived campaign</Badge>}
                          {isRedeemed && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-600">Redeemed</span>}
                        </div>
                        <p className="mt-1 truncate text-xs font-mono text-muted-foreground">ID: {card.uniqueId.slice(0, 8)}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 shrink-0 p-0" disabled={mutationBusy}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Manage Card</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openPublicLink(card.uniqueId)}>
                          <ExternalLink className="mr-2 h-4 w-4" /> Public Link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {!isStaff && (
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleRevokeCard(customer.id, card.id)}
                          >
                            <Trash className="mr-2 h-4 w-4" /> Revoke
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className={cn("mt-4 flex items-center gap-2", isRedeemed && "opacity-60")}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {customer.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{customer.name}</p>
                      {(customer.email || customer.mobile) && (
                        <p className="truncate text-xs text-muted-foreground">{customer.email || customer.mobile}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Progress</span>
                      {isRedeemed ? (
                        <span className="text-sm font-medium text-muted-foreground">Completed</span>
                      ) : (
                        <span className="text-sm font-bold text-foreground">
                          {card.stamps} <span className="font-normal text-muted-foreground">/ {campaign.totalStamps}</span>
                        </span>
                      )}
                    </div>
                    {!isRedeemed && (
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={cn("h-full rounded-full transition-all", canRedeem ? "bg-green-500" : "bg-primary")}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant={isRedeemed ? "outline" : "default"}
                      className={cn("w-full gap-2 rounded-full", canRedeem && !isRedeemed ? "bg-green-600 hover:bg-green-700" : "")}
                      onClick={() => setActiveKioskData({ customer, card, template: campaign })}
                    >
                      {isRedeemed ? <Lock size={14} /> : <MonitorPlay size={14} />}
                      {isRedeemed ? "View Card" : (canRedeem ? "Redeem Reward" : "Open Kiosk")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[300px]">Card Details</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cardRows.map(({ customer, card, campaign, progress, canRedeem, isRedeemed, isArchivedCampaign }) => (
                    <TableRow key={card.id} className={cn("transition-colors", isRedeemed ? "bg-gray-50/50 hover:bg-gray-50" : "hover:bg-muted/30")}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg",
                            isRedeemed ? "bg-gray-100 text-gray-400" : "bg-primary/10 text-primary"
                          )}>
                            {isRedeemed ? <Lock size={18} /> : <CreditCard size={20} />}
                          </div>
                          <div className={cn(isRedeemed && "opacity-60")}>
                            <div className="flex items-center gap-2 font-semibold text-foreground">
                              {card.campaignName}
                              {isArchivedCampaign && <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Archived campaign</Badge>}
                              {isRedeemed && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-600">Redeemed</span>}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground">ID: {card.uniqueId.slice(0, 8)}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={cn("flex items-center gap-2", isRedeemed && "opacity-60")}>
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {customer.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium">{customer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {isRedeemed ? (
                          <div className="text-sm font-medium text-muted-foreground">Completed</div>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <div className="text-sm font-bold">
                              {card.stamps} <span className="font-normal text-muted-foreground">/ {campaign.totalStamps}</span>
                            </div>
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className={cn("h-full rounded-full transition-all", canRedeem ? "bg-green-500" : "bg-primary")}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 rounded-full"
                            onClick={() => openPublicLink(card.uniqueId)}
                            aria-label="Open public link"
                            title="Open public link"
                          >
                            <ExternalLink size={14} />
                          </Button>
                          <Button
                            size="sm"
                            variant={isRedeemed ? "outline" : "default"}
                            className={cn("gap-2 rounded-full", canRedeem && !isRedeemed ? "bg-green-600 hover:bg-green-700" : "")}
                            onClick={() => setActiveKioskData({ customer, card, template: campaign })}
                          >
                            {isRedeemed ? <Lock size={14} /> : <MonitorPlay size={14} />}
                            {isRedeemed ? "View" : (canRedeem ? "Redeem" : "Kiosk")}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={mutationBusy}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Manage Card</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openPublicLink(card.uniqueId)}>
                              <ExternalLink className="mr-2 h-4 w-4" /> Public Link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {!isStaff && (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleRevokeCard(customer.id, card.id)}
                              >
                                <Trash className="mr-2 h-4 w-4" /> Revoke
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
