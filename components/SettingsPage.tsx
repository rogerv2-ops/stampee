import React, { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useAuth } from "./AuthProvider";
import { buildStaffPortalUrl } from "../lib/links";
import { Link, useNavigate } from "react-router-dom";
import { useSubscriptionContext } from "./SubscriptionContext";
import { useI18n } from "../lib/i18n";
import { APP_ORIGIN } from "../lib/siteConfig";

const DELETE_CONFIRMATION = "DELETE";

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { staffAccounts, createStaff, updateStaffPin, setStaffAccess, deleteStaff, currentOwner, activeBusiness, currentUser, deleteAccount, updateProfileInfo, updatePassword } = useAuth();
  useSubscriptionContext();

  const [profileForm, setProfileForm] = useState({
    businessName: activeBusiness?.businessName ?? currentUser?.businessName ?? "",
    email: currentUser?.email ?? "",
    slug: activeBusiness?.slug ?? "",
  });
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  useEffect(() => {
    setProfileForm({
      businessName: activeBusiness?.businessName ?? currentUser?.businessName ?? "",
      email: currentUser?.email ?? "",
      slug: activeBusiness?.slug ?? "",
    });
  }, [currentUser?.email, currentUser?.businessName, activeBusiness?.id, activeBusiness?.businessName, activeBusiness?.slug]);

  const [passwordForm, setPasswordForm] = useState({ next: "", confirm: "" });
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", pin: "" });
  const [error, setError] = useState("");
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffActionBusyId, setStaffActionBusyId] = useState<string | null>(null);
  const [staffActionError, setStaffActionError] = useState("");
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [resetPin, setResetPin] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [deleteStaffTarget, setDeleteStaffTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteStaffError, setDeleteStaffError] = useState("");
  const [deleteStaffBusy, setDeleteStaffBusy] = useState(false);
  const [isDeleteStepOneOpen, setIsDeleteStepOneOpen] = useState(false);
  const [isDeleteStepTwoOpen, setIsDeleteStepTwoOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setProfileBusy(true);
    const result = await updateProfileInfo({
      businessName: profileForm.businessName,
      email: profileForm.email,
    });
    setProfileBusy(false);
    if (!result.ok) {
      setProfileError(t(result.error));
    } else {
      setProfileSuccess(t("Profile updated successfully."));
      setTimeout(() => setProfileSuccess(""), 3000);
    }
  };

  const handlePasswordSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError(t("New passwords do not match."));
      return;
    }
    setPasswordBusy(true);
    const result = await updatePassword(passwordForm.next);
    setPasswordBusy(false);
    if (!result.ok) {
      setPasswordError(t(result.error));
    } else {
      setPasswordSuccess(t("Password changed successfully."));
      setPasswordForm({ next: "", confirm: "" });
      setTimeout(() => setPasswordSuccess(""), 3000);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setStaffActionError("");
    setStaffBusy(true);
    const result = await createStaff(form);
    setStaffBusy(false);
    if (!result.ok) {
      setError(t(result.error));
      return;
    }
    setForm({ name: "", email: "", pin: "" });
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    setResetError("");
    setResetBusy(true);
    const result = await updateStaffPin(resetTarget.id, resetPin);
    setResetBusy(false);
    if (!result.ok) {
      setResetError(t(result.error));
      return;
    }
    setResetPin("");
    setResetTarget(null);
  };

  const handleSetStaffAccess = async (staffId: string, access: "active" | "disabled") => {
    setStaffActionError("");
    setStaffActionBusyId(staffId);
    const result = await setStaffAccess(staffId, access);
    setStaffActionBusyId(null);
    if (!result.ok) {
      setStaffActionError(t(result.error));
    }
  };

  const handleDeleteFinal = async () => {
    setDeleteError("");
    if (deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRMATION) {
      setDeleteError(t("Type {confirmation} to confirm account deletion.", { confirmation: DELETE_CONFIRMATION }));
      return;
    }

    setDeleteAccountBusy(true);
    const result = await deleteAccount();
    setDeleteAccountBusy(false);
    if (!result.ok) {
      setDeleteError(t(result.error));
      return;
    }

    setIsDeleteStepTwoOpen(false);
    setDeleteConfirmText("");
    navigate("/signup");
  };

  const handleDeleteStaff = async () => {
    if (!deleteStaffTarget) return;
    setDeleteStaffError("");
    setDeleteStaffBusy(true);
    const result = await deleteStaff(deleteStaffTarget.id);
    setDeleteStaffBusy(false);
    if (!result.ok) {
      setDeleteStaffError(t(result.error));
      return;
    }
    setDeleteStaffTarget(null);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-fade-in h-full overflow-y-auto flex flex-col bg-gray-50/50">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{t("Settings")}</h1>
        <p className="text-sm text-muted-foreground">{t("Manage your profile, password, team, and account.")}</p>
      </div>
      <section className="rounded-2xl md:rounded-3xl border bg-white p-4 md:p-6 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("Business workspaces")}</h2>
          <p className="text-sm text-muted-foreground">{t("Create another independent business or switch between your existing workspaces.")}</p>
        </div>
        <Link to="/businesses" className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90">{t("Manage businesses")}</Link>
      </section>

      {/* Edit Profile */}
      <section className="rounded-2xl md:rounded-3xl border bg-white p-4 md:p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-lg md:text-xl font-semibold">{t("Edit Profile")}</h2>
          <p className="text-sm text-muted-foreground">{t("Update your business name and email address.")}</p>
        </div>
        <form className="space-y-4" onSubmit={handleProfileSave}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("Business / Display Name")}</Label>
              <Input
                value={profileForm.businessName}
                onChange={(e) => setProfileForm({ ...profileForm, businessName: e.target.value })}
                placeholder={t("Your Business")}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Email Address")}</Label>
              <Input
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                type="email"
                placeholder={t("you@brand.com")}
                required
              />
            </div>
            {currentUser?.role === "owner" && (
              <div className="space-y-1.5">
                <Label>{t("Public URL Slug")}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">{APP_ORIGIN.replace(/^https?:\/\//, "")}/</span>
                  <Input
                    value={profileForm.slug}
                    readOnly
                    className="bg-muted/40 text-muted-foreground cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">{t("Your public URL cannot be changed after signup.")}</p>
              </div>
            )}
          </div>
          {profileError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {profileError}
            </div>
          )}
          {profileSuccess && (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {profileSuccess}
            </div>
          )}
          <div>
            <Button type="submit" className="rounded-full px-6" disabled={profileBusy}>
              {profileBusy ? t(t("Saving...")) : t("Save Profile")}
            </Button>
          </div>
        </form>
      </section>

      {/* Change Password */}
      <section className="rounded-2xl md:rounded-3xl border bg-white p-4 md:p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-lg md:text-xl font-semibold">{t("Change Password")}</h2>
          <p className="text-sm text-muted-foreground">{t("Update your account password. Must be at least 6 characters.")}</p>
        </div>
        <form className="space-y-4" onSubmit={handlePasswordSave}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("New Password")}</Label>
              <Input
                type="password"
                value={passwordForm.next}
                onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Confirm New Password")}</Label>
              <Input
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          {passwordError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {passwordSuccess}
            </div>
          )}
          <div>
            <Button type="submit" className="rounded-full px-6" disabled={passwordBusy}>
              {passwordBusy ? t("Changing...") : t("Change Password")}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl md:rounded-3xl border bg-white p-4 md:p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg md:text-xl font-semibold">{t("Staff Accounts")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("Create staff logins for issuing cards and managing stamps.")}
            </p>
          </div>
          {activeBusiness?.slug && activeBusiness?.id && (
            <div className="text-xs text-muted-foreground space-y-2 md:text-right">
              <div>
                {t("Org ID:")} <span className="font-mono break-all">{activeBusiness.id}</span>
              </div>
              <div className="text-[11px] text-muted-foreground/80">
                {t("Share this Org ID or portal link with staff.")}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={buildStaffPortalUrl(activeBusiness.slug, activeBusiness.id)}
                  className="text-[11px] font-mono bg-muted/40 min-w-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => navigator.clipboard.writeText(buildStaffPortalUrl(activeBusiness.slug!, activeBusiness.id))}
                >{t("Copy")}
                </Button>
              </div>
            </div>
          )}
        </div>

        <form className="space-y-3" onSubmit={handleCreate}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t("Name")}</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={t("Jamie Staff")}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Email")}</Label>
              <Input
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="staff@brand.com"
                type="email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("PIN")}</Label>
              <Input
                value={form.pin}
                onChange={(event) => setForm({ ...form, pin: event.target.value })}
                placeholder={t("4-6 digits")}
                maxLength={6}
                required
              />
            </div>
          </div>
          <Button type="submit" className="rounded-full h-10 px-6 w-full sm:w-auto" disabled={staffBusy}>
            {staffBusy ? t("Adding...") : t("Add Staff")}
          </Button>
        </form>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {staffActionError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {staffActionError}
          </div>
        )}

        {/* Staff table — desktop */}
        <div className="hidden md:block rounded-2xl border border-slate-100 overflow-hidden">
          <div className="grid grid-cols-[1.2fr_1.4fr_0.8fr_auto] gap-4 px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground bg-slate-50">
            <span>{t("Name")}</span>
            <span>{t("Email")}</span>
            <span>{t("Status")}</span>
            <span className="text-right">{t("Actions")}</span>
          </div>
          {staffAccounts.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              {t("No staff yet. Add your first teammate above.")}
            </div>
          ) : (
            staffAccounts.map((staff) => (
              <div
                key={staff.id}
                className="grid grid-cols-[1.2fr_1.4fr_0.8fr_auto] gap-4 px-4 py-4 border-t items-center"
              >
                <div className="font-medium text-foreground truncate">{staff.businessName}</div>
                <div className="text-sm text-muted-foreground truncate">{staff.email}</div>
                <div>
                  <Badge
                    variant={staff.access === "active" ? "secondary" : "destructive"}
                    className="uppercase tracking-wider"
                  >
                    {staff.access}
                  </Badge>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={staffActionBusyId === staff.id}
                    onClick={() => {
                      setResetTarget({ id: staff.id, name: staff.businessName });
                      setResetPin("");
                      setResetError("");
                    }}
                  >{t("Reset PIN")}
                  </Button>
                  <Button
                    variant={staff.access === "active" ? "destructive" : "default"}
                    size="sm"
                    disabled={staffActionBusyId === staff.id}
                    onClick={() =>
                      handleSetStaffAccess(staff.id, staff.access === "active" ? "disabled" : "active")
                    }
                  >
                    {staffActionBusyId === staff.id ? t("Saving...") : (staff.access === "active" ? t("Disable") : t("Enable"))}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={staffActionBusyId === staff.id}
                    onClick={() => {
                      setDeleteStaffTarget({ id: staff.id, name: staff.businessName });
                      setDeleteStaffError("");
                    }}
                  >{t("Delete")}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Staff list — mobile cards */}
        <div className="md:hidden space-y-3">
          {staffAccounts.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 px-4 py-6 text-sm text-muted-foreground">
              {t("No staff yet. Add your first teammate above.")}
            </div>
          ) : (
            staffAccounts.map((staff) => (
              <div
                key={staff.id}
                className="rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{staff.businessName}</div>
                    <div className="text-sm text-muted-foreground truncate">{staff.email}</div>
                  </div>
                  <Badge
                    variant={staff.access === "active" ? "secondary" : "destructive"}
                    className="uppercase tracking-wider shrink-0"
                  >
                    {staff.access}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={staffActionBusyId === staff.id}
                    onClick={() => {
                      setResetTarget({ id: staff.id, name: staff.businessName });
                      setResetPin("");
                      setResetError("");
                    }}
                  >{t("Reset PIN")}
                  </Button>
                  <Button
                    variant={staff.access === "active" ? "destructive" : "default"}
                    size="sm"
                    className="flex-1"
                    disabled={staffActionBusyId === staff.id}
                    onClick={() =>
                      handleSetStaffAccess(staff.id, staff.access === "active" ? "disabled" : "active")
                    }
                  >
                    {staffActionBusyId === staff.id ? t("Saving...") : (staff.access === "active" ? t("Disable") : t("Enable"))}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    disabled={staffActionBusyId === staff.id}
                    onClick={() => {
                      setDeleteStaffTarget({ id: staff.id, name: staff.businessName });
                      setDeleteStaffError("");
                    }}
                  >{t("Delete")}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl md:rounded-3xl border border-rose-200 bg-rose-50 p-4 md:p-6 shadow-sm space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg md:text-xl font-semibold text-rose-900">{t("Danger Zone")}</h2>
          <p className="text-sm text-rose-800/90">
            {t("Delete your owner account, all staff logins, and all campaign/customer data for this business.")}
          </p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-white/70 px-4 py-3 text-xs text-rose-800">
          {t("This action is permanent and cannot be undone.")}
        </div>
        <div>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setDeleteError("");
              setDeleteConfirmText("");
              setIsDeleteStepOneOpen(true);
            }}
          >{t("Delete Account")}
          </Button>
        </div>
      </section>

      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && !resetBusy && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Reset PIN for {name}", { name: resetTarget?.name ?? "" })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{t("New PIN")}</Label>
            <Input
              value={resetPin}
              onChange={(event) => setResetPin(event.target.value)}
              placeholder={t("4-6 digits")}
              maxLength={6}
            />
            {resetError && (
              <div className="text-sm text-rose-600">{resetError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={resetBusy}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleReset} disabled={resetBusy}>
              {resetBusy ? t("Updating...") : t("Update PIN")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteStaffTarget} onOpenChange={(open) => !open && setDeleteStaffTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Delete staff account?")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("This will permanently remove {name} and revoke their login access.", { name: deleteStaffTarget?.name ?? "" })}
            </p>
            {deleteStaffError && (
              <div className="text-sm text-rose-600">{deleteStaffError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStaffTarget(null)}>
              {t("Cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteStaff} disabled={deleteStaffBusy}>
              {deleteStaffBusy ? t("Deleting...") : t("Delete Staff")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteStepOneOpen} onOpenChange={(open) => !deleteAccountBusy && setIsDeleteStepOneOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Delete Account: Step 1 of 2")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              {t("You are about to delete the account for {name}.", { name: currentOwner?.businessName ?? "" })}
            </p>
            <p>{t("This will remove owner access, all businesses, staff accounts, campaigns, and customer history.")}</p>
            <p className="text-rose-600 font-medium">{t("This action cannot be undone.")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteStepOneOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setIsDeleteStepOneOpen(false);
                setDeleteError("");
                setDeleteConfirmText("");
                setIsDeleteStepTwoOpen(true);
              }}
            >
              {t("Continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteStepTwoOpen}
        onOpenChange={(open) => {
          if (deleteAccountBusy) return;
          setIsDeleteStepTwoOpen(open);
          if (!open) {
            setDeleteConfirmText("");
            setDeleteError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Delete Account: Step 2 of 2")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("Type {confirmation} to permanently delete this account.", { confirmation: DELETE_CONFIRMATION })}
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder={DELETE_CONFIRMATION}
            />
            {deleteError && <div className="text-sm text-rose-600">{deleteError}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteStepTwoOpen(false)} disabled={deleteAccountBusy}>
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFinal}
              disabled={deleteAccountBusy || deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRMATION}
            >
              {deleteAccountBusy ? t("Deleting...") : t("Permanently Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
