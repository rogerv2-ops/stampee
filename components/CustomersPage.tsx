import React, { useState } from 'react';
import { useI18n } from "../lib/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
    MoreHorizontal, Plus, Search, Trash, Edit, Phone, Mail, Stamp,
    CreditCard, Minus, Gift, ExternalLink, ArrowLeft, UserPlus,
    CheckCircle2, User, ChevronRight
} from "lucide-react";
import { cn } from "../lib/utils";
import { Customer, Template, IssuedCard, Transaction } from '../types';
import { IssueCardDialog } from './IssueCardDialog';
import { useAuth } from './AuthProvider';
import { buildPublicCardUrl } from '../lib/links';
import { resolveCardTemplate } from '../lib/templateSerialization';

interface CustomersPageProps {
  customers: Customer[];
  campaigns: Template[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

const formatPhoneNumber = (value: string) => {
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

export const CustomersPage: React.FC<CustomersPageProps> = ({ customers, campaigns, setCustomers }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { currentUser, currentOwner, activeBusiness } = useAuth();
  const { t, locale } = useI18n();

  // Dialog States
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStampOpen, setIsStampOpen] = useState(false);
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);

  // Single Action State
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [activeCard, setActiveCard] = useState<IssuedCard | null>(null);

  const [mobileError, setMobileError] = useState<string>("");

  // Edit Form State
  const [editFormData, setEditFormData] = useState<{name: string; email: string; mobile: string}>({
    name: '', email: '', mobile: ''
  });

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const input = e.target.value;
    const formatted = formatPhoneNumber(input);
    const digits = formatted.replace(/[^\d]/g, '');

    if (isEdit) {
        setEditFormData({ ...editFormData, mobile: formatted });
    }

    if (digits.length > 0 && digits.length < 10) {
        setMobileError(t("Enter 10 digits"));
    } else {
        setMobileError("");
    }
  };

  const openIssueWizard = () => {
    setIsIssueOpen(true);
  };

  const handleIssueCard = (campaign: Template, customer: Customer | null, newCustomerData: {name: string, email: string, mobile: string}): IssuedCard => {
      let targetCustomer = customer;
      const actorName = currentUser?.businessName ?? t("Owner");
      const actorRole = currentUser?.role ?? "owner";
      const actorId = currentUser?.id;

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
      }

      const now = new Date();
      const initialTransaction: Transaction = {
          id: `tx-init-${Date.now()}`,
          type: 'issued',
          amount: 0,
          date: now.toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
          }),
          timestamp: now.getTime(),
          title: t("Card Issued"),
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
          history: [initialTransaction]
      };

      const targetId = targetCustomer!.id;
      const customerToAdd = targetCustomer!;

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

  // --- OTHER ACTIONS ---

  const handleEditSave = () => {
    if (mobileError || !activeCustomer) return;
    const updatedCustomers = customers.map(c =>
        c.id === activeCustomer.id ? { ...c, ...editFormData } : c
    );
    setCustomers(updatedCustomers);
    setIsEditOpen(false);
    setActiveCustomer(null);
  };

  const updateCardStamps = (amount: number, reset: boolean = false) => {
    if (!activeCustomer || !activeCard) return;

    const campaign = resolveCardTemplate(activeCard, campaigns);
    const maxStamps = campaign ? campaign.totalStamps : 10;

    let newStamps = reset ? 0 : activeCard.stamps + amount;
    if (newStamps > maxStamps) return;
    if (newStamps < 0) return;

    // Create transaction
    const now = new Date();
    const txType = reset ? 'redeem' : (amount > 0 ? 'stamp_add' : 'stamp_remove');
    const txTitle = reset ? t("Reward Redeemed") : (amount > 0 ? t("Stamp Collected") : t("Stamp Removed"));
    const newTransaction: Transaction = {
        id: `tx-${Date.now()}`,
        type: txType,
        amount: reset ? 0 : amount,
        date: now.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }),
        timestamp: now.getTime(),
        title: txTitle,
        actorName: currentUser?.businessName ?? t("Owner"),
        actorRole: currentUser?.role ?? "owner",
        actorId: currentUser?.id
    };

    const updatedCard = {
        ...activeCard,
        stamps: newStamps,
        lastVisit: new Date().toISOString().split('T')[0],
        history: [newTransaction, ...activeCard.history] // Prepend new transaction
    };

    if (reset) {
        updatedCard.status = 'Redeemed';
        updatedCard.completedDate = new Date().toISOString().split('T')[0];
    }

    const updatedCustomers = customers.map(c => {
        if (c.id === activeCustomer.id) {
            return {
                ...c,
                cards: c.cards.map(card => card.id === activeCard.id ? updatedCard : card)
            };
        }
        return c;
    });

    setCustomers(updatedCustomers);
  };

  const handleAddStamp = () => {
     updateCardStamps(1);
     setIsStampOpen(false);
  };

  const handleRemoveStamp = (customer: Customer, card: IssuedCard) => {
    // Instant update
    if (card.stamps > 0) {
        const now = new Date();
        const newTransaction: Transaction = {
            id: `tx-${Date.now()}`,
            type: 'stamp_remove',
            amount: -1,
            date: now.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }),
            timestamp: now.getTime(),
            title: t("Stamp Removed"),
            remarks: t("Manual correction"),
            actorName: currentUser?.businessName ?? t("Owner"),
            actorRole: currentUser?.role ?? "owner",
            actorId: currentUser?.id
        };

        const updatedCard = {
            ...card,
            stamps: card.stamps - 1,
            history: [newTransaction, ...card.history]
        };
        setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, cards: c.cards.map(cc => cc.id === card.id ? updatedCard : cc) } : c));
    }
  };

  const handleRedeemReward = () => {
     updateCardStamps(0, true);
     setIsRedeemOpen(false);
  };

  const handleDeleteCard = (customerId: string, cardId: string) => {
    const updatedCustomers = customers.map(c => {
        if (c.id === customerId) {
             return { ...c, cards: c.cards.filter(card => card.id !== cardId) };
        }
        return c;
    }).filter(c => c.cards.length > 0 || c.id !== customerId); // Optional: Keep empty customers? Currently keeping if cards length 0 unless filtered elsewhere
    setCustomers(updatedCustomers);
  };

  // Flatten logic
  const flatList = customers.flatMap(c => c.cards.map(card => ({ customer: c, card })));
  const filteredList = flatList.filter(({ customer, card }) =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.campaignName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6 animate-fade-in h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("Issued Cards")}</h1>
            <p className="text-muted-foreground">{t("Manage active cards across all campaigns.")}</p>
        </div>
        <Button onClick={openIssueWizard} className="gap-2 shadow-sm">
            <Plus size={16} /> {t("Issue New Card")}
        </Button>
      </div>

       <IssueCardDialog
          isOpen={isIssueOpen}
          onClose={() => setIsIssueOpen(false)}
          campaigns={campaigns}
          customers={customers}
          onIssue={handleIssueCard}
      />

      <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-md border w-full max-w-sm shadow-sm focus-within:ring-2 focus-within:ring-ring">
        <Search className="text-gray-400" size={20} />
        <input
            className="flex-1 outline-none text-sm bg-transparent placeholder:text-muted-foreground"
            placeholder={t("Search by name, email, or campaign...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="rounded-lg border bg-white flex-1 overflow-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>{t("Cardholder")}</TableHead>
              <TableHead>{t("Campaign")}</TableHead>
              <TableHead>{t("Contact")}</TableHead>
              <TableHead className="text-right">{t("Balance")}</TableHead>
              <TableHead className="text-right">{t("Last Visit")}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredList.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                        {t("No issued cards found.")}
                    </TableCell>
                </TableRow>
            ) : (
                filteredList.map(({ customer, card }) => (
                <TableRow key={card.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                {customer.name.substring(0,2).toUpperCase()}
                            </div>
                            <div className="font-semibold">{customer.name}</div>
                        </div>
                    </TableCell>
                    <TableCell>
                         <div className="flex items-center gap-1.5">
                            <CreditCard size={14} className="text-muted-foreground" />
                            <span className="text-sm font-medium">{card.campaignName}</span>
                         </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex flex-col text-sm space-y-0.5">
                            <span className="flex items-center gap-1.5 text-foreground/80">
                                <Mail size={12} className="text-muted-foreground"/> {customer.email}
                            </span>
                        </div>
                    </TableCell>
                    <TableCell className="text-right">
                         <div className="flex items-center justify-end gap-1 font-bold text-lg text-primary">
                            <Stamp size={16} className="text-primary/70" />
                            {card.stamps}
                         </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">{card.lastVisit}</TableCell>
                    <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
                                    <span className="sr-only">{t("Open menu")}</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>{t("Actions")}</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => {
                                    const slug = activeBusiness?.slug;
                                    if (!slug) return;
                                    window.open(buildPublicCardUrl(slug, card.uniqueId), '_blank');
                                }} className="cursor-pointer">
                                    <ExternalLink className="mr-2 h-4 w-4" /> {t("Public View")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => { setActiveCustomer(customer); setActiveCard(card); setIsStampOpen(true); }}
                                    className="cursor-pointer font-medium text-green-600 focus:text-green-600"
                                >
                                    <Plus className="mr-2 h-4 w-4" /> {t("Add Stamp")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => handleRemoveStamp(customer, card)}
                                    className="cursor-pointer text-orange-600 focus:text-orange-600"
                                    disabled={card.stamps === 0}
                                >
                                    <Minus className="mr-2 h-4 w-4" /> {t("Remove Stamp")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => { setActiveCustomer(customer); setActiveCard(card); setIsRedeemOpen(true); }}
                                    className="cursor-pointer font-medium text-purple-600 focus:text-purple-600"
                                >
                                    <Gift className="mr-2 h-4 w-4" /> {t("Redeem Reward")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => {
                                        setActiveCustomer(customer);
                                        setEditFormData({ name: customer.name, email: customer.email, mobile: customer.mobile || '' });
                                        setIsEditOpen(true);
                                    }}
                                    className="cursor-pointer"
                                >
                                    <Edit className="mr-2 h-4 w-4" /> {t("Edit Profile")}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600 focus:text-red-600 cursor-pointer" onClick={() => handleDeleteCard(customer.id, card.id)}>
                                    <Trash className="mr-2 h-4 w-4" /> {t("Revoke Card")}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>{t("Edit Profile")}</DialogTitle>
                <DialogDescription>{t("Update contact details for {name}.", { name: activeCustomer?.name ?? "" })}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-name" className="text-right">{t("Name")}</Label>
                    <Input
                        id="edit-name"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                        className="col-span-3"
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-email" className="text-right">{t("Email")}</Label>
                    <Input
                        id="edit-email"
                        value={editFormData.email}
                        onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                        className="col-span-3"
                    />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="edit-mobile" className="text-right mt-3">{t("Mobile")}</Label>
                    <div className="col-span-3 space-y-1">
                        <Input
                            id="edit-mobile"
                            placeholder="(555) 000-0000"
                            value={editFormData.mobile}
                            onChange={(e) => handleMobileChange(e, true)}
                            className={cn(mobileError && "border-red-500 focus-visible:ring-red-500")}
                        />
                        {mobileError && <p className="text-[10px] text-red-500 ml-1">{mobileError}</p>}
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>{t("Cancel")}</Button>
                <Button onClick={handleEditSave} disabled={!!mobileError}>{t("Save Changes")}</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

       {/* Add Stamp Dialog */}
       <Dialog open={isStampOpen} onOpenChange={setIsStampOpen}>
        <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
                <DialogTitle>{t("Add Stamp")}</DialogTitle>
                <DialogDescription>{t("Record a purchase for {name}?", { name: activeCustomer?.name ?? "" })}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-8 gap-6">
                <div className="relative">
                     <div className="w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center text-primary border-4 border-primary/10 shadow-inner animate-pulse">
                        <Stamp size={40} />
                     </div>
                     <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-sm font-bold px-2.5 py-1 rounded-full border-2 border-white shadow-sm">
                        +1
                     </div>
                </div>
                <div className="text-center space-y-1">
                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">{t("New Balance")}</p>
                    <div className="text-4xl font-bold flex items-center justify-center gap-3">
                         <span className="text-muted-foreground/30">{activeCard?.stamps}</span>
                         <span className="text-muted-foreground/30">→</span>
                         <span className="text-primary">{activeCard ? activeCard.stamps + 1 : 0}</span>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsStampOpen(false)}>{t("Cancel")}</Button>
                <Button onClick={handleAddStamp} className="gap-2"><Stamp size={16}/> {t("Confirm Stamp")}</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redeem Reward Dialog */}
      <Dialog open={isRedeemOpen} onOpenChange={setIsRedeemOpen}>
        <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
                <DialogTitle>{t("Redeem Reward")}</DialogTitle>
                <DialogDescription>{t("Deduct all stamps for reward?")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-6 gap-6">
                <div className="w-20 h-20 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 border-4 border-purple-100">
                    <Gift size={32} />
                </div>
                <p className="text-center text-sm text-muted-foreground px-6">
                    {t("This will reset the {name} stamp balance to 0.", { name: activeCard?.campaignName ?? "" })}
                </p>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsRedeemOpen(false)}>{t("Cancel")}</Button>
                <Button onClick={handleRedeemReward} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
                    <Gift size={16}/> {t("Confirm Redemption")}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
