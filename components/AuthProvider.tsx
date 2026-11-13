import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { TIER_LIMITS, User, Business } from "../types";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { fetchProfile, fetchProfileDetailed, fetchStaffAccounts } from "../lib/db/profiles";
import { normalizeSlug } from "../lib/slug";
import { buildAppUrl, DEMO_WORKSPACE_ENABLED } from "../lib/siteConfig";
import { createBusiness as dbCreateBusiness, fetchBusinesses } from "../lib/db/businesses";

type AuthUserLike = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export type AuthResult = { ok: true; user?: User; message?: string } | { ok: false; error: string };
type RepairResult = { ok: true } | { ok: false; error: string };

interface AuthContextValue {
  currentUser: User | null;
  currentOwner: User | null;
  businesses: Business[];
  activeBusiness: Business | null;
  switchBusiness: (id: string) => void;
  createBusiness: (payload: { businessName: string; slug: string }) => Promise<AuthResult>;
  isOwner: boolean;
  isStaff: boolean;
  isEmailVerified: boolean;
  loading: boolean;
  staffAccounts: User[];
  login: (email: string, password: string) => Promise<AuthResult>;
  loginStaff: (email: string, pin: string, orgId: string) => Promise<AuthResult>;
  signup: (payload: { businessName: string; email: string; password: string; slug: string }) => Promise<AuthResult>;
  loginDemo: () => Promise<void>;
  createStaff: (payload: { name: string; email: string; pin: string }) => Promise<AuthResult>;
  updateStaffPin: (staffId: string, pin: string) => Promise<AuthResult>;
  setStaffAccess: (staffId: string, access: "active" | "disabled") => Promise<AuthResult>;
  deleteStaff: (staffId: string) => Promise<AuthResult>;
  deleteAccount: () => Promise<AuthResult>;
  logout: () => Promise<void>;
  resendVerificationEmail: () => Promise<AuthResult>;
  isSlugAvailable: (slug: string) => Promise<boolean>;
  updateProfileInfo: (payload: { businessName?: string; email?: string; slug?: string }) => Promise<AuthResult>;
  updatePassword: (newPassword: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const CONFIG_ERROR_MESSAGE = "Service is temporarily unavailable. Please try again later.";
const AUTH_REQUEST_ERROR = "We couldn't complete your request right now. Please try again.";
const SIGNIN_ERROR_MESSAGE = "Unable to sign in right now. Please try again.";
const SIGNUP_ERROR_MESSAGE = "Unable to create your account right now. Please try again.";
const SIGNUP_EMAIL_EXISTS_MESSAGE = "An account with this email already exists. Please log in instead.";
const ACCOUNT_SETUP_ERROR = "We couldn't finish setting up your account. Please try again.";
const PROFILE_UPDATE_ERROR = "Unable to update your profile right now. Please try again.";
const PASSWORD_UPDATE_ERROR = "Unable to update your password right now. Please try again.";
const PASSWORD_RESET_ERROR = "Unable to send a reset link right now. Please try again.";
const STAFF_ACTION_ERROR = "Unable to complete this staff action right now. Please try again.";
const ACCOUNT_ACTION_ERROR = "Unable to complete this account action right now. Please try again.";

const isDuplicateSignupError = (message: string | undefined) => {
  const normalized = (message || "").trim().toLowerCase();
  return normalized.includes("already registered") || normalized.includes("already exists");
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentOwner, setCurrentOwner] = useState<User | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [staffAccounts, setStaffAccounts] = useState<User[]>([]);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const sessionGenerationRef = useRef(0);
  const businessSelectionRef = useRef<{ id: string | null; generation: number }>({ id: null, generation: 0 });

  const setSelectedBusiness = useCallback((business: Business | null) => {
    businessSelectionRef.current = {
      id: business?.id ?? null,
      generation: businessSelectionRef.current.generation + 1,
    };
    setActiveBusiness(business);
  }, []);

  const refreshStaffAccountsForBusiness = useCallback(async (businessId: string) => {
    const generation = businessSelectionRef.current.generation;
    if (businessSelectionRef.current.id !== businessId) return;
    let nextStaffAccounts: User[];
    try {
      nextStaffAccounts = await fetchStaffAccounts(businessId);
    } catch {
      return;
    }
    if (businessSelectionRef.current.id === businessId && businessSelectionRef.current.generation === generation) {
      setStaffAccounts(nextStaffAccounts);
    }
  }, []);

  const fetchProfileWithRetry = useCallback(async (userId: string, attempts = 5, delayMs = 200): Promise<User | null> => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const profile = await fetchProfile(userId);
      if (profile) return profile;
      if (attempt < attempts - 1) {
        await new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), delayMs);
        });
      }
    }
    return null;
  }, []);

  const waitForAuthUser = useCallback(async (userId: string, attempts = 12, delayMs = 150): Promise<boolean> => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const { data } = await supabase.auth.getUser();
      if (data.user?.id === userId) return true;
      if (attempt < attempts - 1) {
        await new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), delayMs);
        });
      }
    }
    return false;
  }, []);

  const createMissingProfile = useCallback(async (authUser: AuthUserLike): Promise<RepairResult> => {
    const metadata = authUser.user_metadata ?? {};
    if (metadata.role === "staff") return { ok: false, error: ACCOUNT_SETUP_ERROR };
    const role: "owner" = "owner";
    const rawBusinessName = typeof metadata.business_name === "string" ? metadata.business_name.trim() : "";
    const fallbackName = authUser.email?.split("@")[0]?.trim() || "New Business";
    const businessName = rawBusinessName || fallbackName;
    const slugRaw = typeof metadata.slug === "string" ? metadata.slug : "";
    const slug = role === "owner" ? normalizeSlug(slugRaw) || null : null;

    const payload = {
      id: authUser.id,
      business_name: businessName,
      email: (authUser.email || "").trim().toLowerCase(),
      slug,
      role,
      owner_id: null,
      status: "unverified",
      access: "active",
      tier: "free",
    };

    let { error } = await supabase.from("profiles").insert(payload);

    // If slug conflicts, retry once without slug so login can proceed.
    if (error && error.message.toLowerCase().includes("profiles_slug_key")) {
      const retry = await supabase.from("profiles").insert({ ...payload, slug: null });
      error = retry.error;
    }

    if (!error) return { ok: true };

    // If another process created it first, treat as success.
    if (error.message.toLowerCase().includes("duplicate key value")) {
      return { ok: true };
    }
    return { ok: false, error: ACCOUNT_SETUP_ERROR };
  }, []);

  const loadFullSession = useCallback(async (userId: string, authUser?: AuthUserLike, expectedGeneration?: number) => {
    const requestGeneration = expectedGeneration ?? ++sessionGenerationRef.current;
    if (requestGeneration !== sessionGenerationRef.current) return;
    const selectionAtStart = businessSelectionRef.current;
    const isCurrentRequest = () => requestGeneration === sessionGenerationRef.current;
    await waitForAuthUser(userId);
    if (!isCurrentRequest()) return;
    setIsEmailVerified(Boolean(authUser?.email_confirmed_at));
    let profile = await fetchProfileWithRetry(userId);
    if (!isCurrentRequest()) return;
    if (!profile && authUser) {
      const repaired = await createMissingProfile(authUser);
      if (repaired.ok) {
        profile = await fetchProfileWithRetry(userId, 3, 150);
      }
    }
    if (!isCurrentRequest()) return;
    if (!profile) {
      setCurrentUser(null);
      setCurrentOwner(null);
      setStaffAccounts([]);
      setBusinesses([]);
      setSelectedBusiness(null);
      setIsEmailVerified(false);
      setLoading(false);
      return;
    }

    setCurrentUser(profile);
    const nextBusinesses = await fetchBusinesses(profile);
    if (!isCurrentRequest()) return;
    const savedBusinessId = businessSelectionRef.current.generation !== selectionAtStart.generation
      ? businessSelectionRef.current.id
      : window.localStorage.getItem(`stampee.active-business:${profile.id}`);
    const nextBusiness = nextBusinesses.find((business) => business.id === savedBusinessId)
      ?? nextBusinesses.find((business) => business.id === profile.id)
      ?? nextBusinesses[0]
      ?? null;
    setBusinesses(nextBusinesses);
    setSelectedBusiness(nextBusiness);
    setStaffAccounts([]);
    if (nextBusiness) {
      window.localStorage.setItem(`stampee.active-business:${profile.id}`, nextBusiness.id);
    }

    const owner = profile.role === "owner" ? profile : profile.ownerId ? await fetchProfile(profile.ownerId) : null;
    if (!isCurrentRequest()) return;
    setCurrentOwner(owner);
    if (profile.role === "owner" && nextBusiness) {
      await refreshStaffAccountsForBusiness(nextBusiness.id);
    } else {
      setStaffAccounts([]);
    }
    if (isCurrentRequest()) setLoading(false);
  }, [createMissingProfile, fetchProfileWithRetry, refreshStaffAccountsForBusiness, setSelectedBusiness, waitForAuthUser]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      sessionGenerationRef.current += 1;
      setCurrentUser(null);
      setCurrentOwner(null);
      setStaffAccounts([]);
      setBusinesses([]);
      setSelectedBusiness(null);
      setIsEmailVerified(false);
      setLoading(false);
      return;
    }

    let mounted = true;

    const init = async () => {
      const requestGeneration = ++sessionGenerationRef.current;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted && requestGeneration === sessionGenerationRef.current) {
          await loadFullSession(session.user.id, session.user, requestGeneration);
        }
      } catch {
        // ignore — loading will still be cleared
      } finally {
        if (mounted && requestGeneration === sessionGenerationRef.current) setLoading(false);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_IN" && session?.user) {
        const requestGeneration = ++sessionGenerationRef.current;
        setLoading(true);
        window.setTimeout(() => {
          if (!mounted || requestGeneration !== sessionGenerationRef.current) return;
          void (async () => {
            try {
              await loadFullSession(session.user.id, session.user, requestGeneration);
            } catch {
              // ignore
            } finally {
              if (mounted && requestGeneration === sessionGenerationRef.current) setLoading(false);
            }
          })();
        }, 0);
      } else if (event === "SIGNED_OUT") {
        void fetch("/api/platform/session", {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
        }).catch(() => undefined);
        sessionGenerationRef.current += 1;
        setCurrentUser(null);
        setCurrentOwner(null);
        setBusinesses([]);
        setSelectedBusiness(null);
        setStaffAccounts([]);
        setIsEmailVerified(false);
        setLoading(false);
      } else if (event === "INITIAL_SESSION") {
        // Already handled by init()
      }
    });

    return () => {
      mounted = false;
      sessionGenerationRef.current += 1;
      subscription.unsubscribe();
    };
  }, [loadFullSession, setSelectedBusiness]);

  const refreshProfile = useCallback(async () => {
    if (!isSupabaseConfigured || !currentUser) return;
    const { data } = await supabase.auth.getUser();
    await loadFullSession(currentUser.id, data.user ?? undefined);
  }, [currentUser, loadFullSession]);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { ok: false, error: CONFIG_ERROR_MESSAGE };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          return { ok: false, error: "Please confirm your email before signing in." };
        }
        return { ok: false, error: "Unable to sign in. Please check your credentials and try again." };
      }

      await waitForAuthUser(data.user.id);

      // Verify the profile exists in the database
      let profile = await fetchProfileWithRetry(data.user.id);
      if (!profile) {
        const repaired = await createMissingProfile(data.user);
        if (repaired.ok) {
          profile = await fetchProfileWithRetry(data.user.id, 3, 150);
        } else {
          await supabase.auth.signOut();
          return {
            ok: false,
            error: ACCOUNT_SETUP_ERROR,
          };
        }
      }
      if (!profile) {
        await supabase.auth.signOut();
        await fetchProfileDetailed(data.user.id);
        return {
          ok: false,
          error: ACCOUNT_SETUP_ERROR,
        };
      }

      await loadFullSession(data.user.id, data.user);
      return { ok: true, user: profile };
    } catch {
      return { ok: false, error: SIGNIN_ERROR_MESSAGE };
    }
  }, [createMissingProfile, fetchProfileWithRetry, loadFullSession, waitForAuthUser]);

  const loginStaff = useCallback(async (email: string, pin: string, orgId: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { ok: false, error: CONFIG_ERROR_MESSAGE };
    }
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPin = pin.trim();
    const normalizedOrgId = orgId.trim();
    if (!normalizedEmail || !/^\d{4,6}$/.test(normalizedPin) || !normalizedOrgId) {
      return { ok: false, error: "Email or PIN is incorrect." };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPin,
      });
      if (error) {
        const authError = error as { code?: string; status?: number; message?: string };
        const errorCode = (authError.code || "").toLowerCase();
        const errorMessage = (authError.message || "").toLowerCase();
        if (errorCode === "invalid_credentials" || errorMessage === "invalid login credentials") {
          return { ok: false, error: "Email or PIN is incorrect." };
        }
        return { ok: false, error: SIGNIN_ERROR_MESSAGE };
      }

      await waitForAuthUser(data.user.id);
      let profile = await fetchProfileWithRetry(data.user.id);
      if (!profile) {
        const repaired = await createMissingProfile(data.user);
        if (repaired.ok) {
          profile = await fetchProfileWithRetry(data.user.id, 3, 150);
        } else {
          await supabase.auth.signOut();
          return {
            ok: false,
            error: AUTH_REQUEST_ERROR,
          };
        }
      }
      if (!profile || profile.role !== "staff") {
        await supabase.auth.signOut();
        return { ok: false, error: "This is not a staff account." };
      }
      if (profile.access === "disabled") {
        await supabase.auth.signOut();
        return { ok: false, error: "This account is disabled. Ask the owner to re-enable it." };
      }
      const { data: membership, error: membershipError } = await supabase
        .from("business_memberships")
        .select("business_id, access")
        .eq("business_id", normalizedOrgId)
        .eq("user_id", profile.id)
        .eq("role", "staff")
        .maybeSingle();
      if (membershipError || !membership || membership.access !== "active") {
        await supabase.auth.signOut();
        return { ok: false, error: "Org ID doesn't match this staff account." };
      }
      window.localStorage.setItem(`stampee.active-business:${profile.id}`, normalizedOrgId);
      await loadFullSession(data.user.id, data.user);
      return { ok: true, user: profile };
    } catch {
      return { ok: false, error: SIGNIN_ERROR_MESSAGE };
    }
  }, [createMissingProfile, fetchProfileWithRetry, loadFullSession, waitForAuthUser]);

  const signup = useCallback(async (payload: {
    businessName: string; email: string; password: string; slug: string;
  }): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { ok: false, error: CONFIG_ERROR_MESSAGE };
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        options: {
          data: {
            business_name: payload.businessName.trim(),
            slug: payload.slug,
            role: "owner",
          },
          emailRedirectTo: buildAppUrl("/login"),
        },
      });
      if (error) {
        if (isDuplicateSignupError(error.message)) {
          return { ok: false, error: SIGNUP_EMAIL_EXISTS_MESSAGE };
        }
        return { ok: false, error: SIGNUP_ERROR_MESSAGE };
      }
      if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
        return { ok: false, error: SIGNUP_EMAIL_EXISTS_MESSAGE };
      }
      if (!data.session) {
        return {
          ok: true,
          message: "Signup succeeded. Confirm your email before signing in. Check your inbox and spam folder for the confirmation link.",
        };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: SIGNUP_ERROR_MESSAGE };
    }
  }, []);

  const loginDemo = useCallback(async () => {
    if (!DEMO_WORKSPACE_ENABLED) {
      throw new Error("Demo workspace is currently unavailable.");
    }
    if (!isSupabaseConfigured) return;
    const demoEmail = "demo@stampee.co";
    const demoPassword = "demo1234";
    const { error } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword,
    });
    if (error) {
      await supabase.auth.signUp({
        email: demoEmail,
        password: demoPassword,
        options: {
          data: {
            business_name: "Demo Donut Co.",
            slug: "demo-donut",
            role: "owner",
          },
        },
      });
    }
  }, []);

  const createStaff = useCallback(async (payload: { name: string; email: string; pin: string }): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { ok: false, error: CONFIG_ERROR_MESSAGE };
    }
    if (!currentOwner || currentUser?.role !== "owner") {
      return { ok: false, error: "Only owners can manage staff." };
    }
    if (!activeBusiness) return { ok: false, error: "Select a business before adding staff." };
    if (!/^\d{4,6}$/.test(payload.pin)) {
      return { ok: false, error: "PIN should be 4-6 digits." };
    }
    const staffLimit = TIER_LIMITS[activeBusiness.tier].staff;
    if (staffAccounts.length >= staffLimit) {
      return {
        ok: false,
        error: `Free beta access allows only ${staffLimit} staff account${staffLimit === 1 ? "" : "s"}. Contact hello@stampee.co if you need higher limits.`,
      };
    }

    const { error } = await supabase.rpc("create_staff_account", {
      staff_email: payload.email.trim().toLowerCase(),
      staff_pin: payload.pin,
      staff_name: payload.name.trim(),
      business_id_input: activeBusiness.id,
    });

    if (error) return { ok: false, error: STAFF_ACTION_ERROR };
    await refreshStaffAccountsForBusiness(activeBusiness.id);
    return { ok: true };
  }, [activeBusiness, currentOwner, currentUser, refreshStaffAccountsForBusiness, staffAccounts]);

  const updateStaffPin = useCallback(async (staffId: string, pin: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { ok: false, error: CONFIG_ERROR_MESSAGE };
    }
    if (!currentOwner || currentUser?.role !== "owner") {
      return { ok: false, error: "Only owners can manage staff." };
    }
    if (!activeBusiness) return { ok: false, error: "Select a business before updating staff." };
    if (!/^\d{4,6}$/.test(pin)) {
      return { ok: false, error: "PIN should be 4-6 digits." };
    }
    const { error } = await supabase.rpc("update_staff_pin", {
      staff_id: staffId,
      new_pin: pin,
      business_id_input: activeBusiness.id,
    });
    if (error) return { ok: false, error: STAFF_ACTION_ERROR };
    return { ok: true };
  }, [activeBusiness, currentOwner, currentUser]);

  const setStaffAccess = useCallback(async (staffId: string, access: "active" | "disabled"): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { ok: false, error: CONFIG_ERROR_MESSAGE };
    }
    if (!currentOwner || currentUser?.role !== "owner") {
      return { ok: false, error: "Only owners can manage staff." };
    }
    if (!activeBusiness) return { ok: false, error: "Select a business before updating staff." };
    const { error } = await supabase.rpc("set_staff_access", {
      staff_id: staffId,
      access_input: access,
      business_id_input: activeBusiness.id,
    });
    if (error) return { ok: false, error: STAFF_ACTION_ERROR };
    await refreshStaffAccountsForBusiness(activeBusiness.id);
    return { ok: true };
  }, [activeBusiness, currentOwner, currentUser, refreshStaffAccountsForBusiness]);

  const deleteStaff = useCallback(async (staffId: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { ok: false, error: CONFIG_ERROR_MESSAGE };
    }
    if (!currentOwner || currentUser?.role !== "owner") {
      return { ok: false, error: "Only owners can manage staff." };
    }
    if (!activeBusiness) return { ok: false, error: "Select a business before deleting staff." };
    const { error } = await supabase.rpc("delete_staff_account", {
      staff_id: staffId,
      business_id_input: activeBusiness.id,
    });
    if (error) return { ok: false, error: STAFF_ACTION_ERROR };
    await refreshStaffAccountsForBusiness(activeBusiness.id);
    return { ok: true };
  }, [activeBusiness, currentOwner, currentUser, refreshStaffAccountsForBusiness]);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { ok: false, error: CONFIG_ERROR_MESSAGE };
    }
    if (!currentOwner || currentUser?.role !== "owner") {
      return { ok: false, error: "Only owners can delete the account." };
    }
    const { error } = await supabase.rpc("delete_own_account");
    if (error) return { ok: false, error: ACCOUNT_ACTION_ERROR };
    await supabase.auth.signOut();
    return { ok: true };
  }, [activeBusiness, currentOwner, currentUser]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/platform/session", {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      // The server cookie also has a short fixed lifetime if revocation is unavailable.
    }
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  }, []);

  const resendVerificationEmail = useCallback(async (): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { ok: false, error: CONFIG_ERROR_MESSAGE };
    }
    const email = currentUser?.email?.trim().toLowerCase();
    if (!email) {
      return { ok: false, error: AUTH_REQUEST_ERROR };
    }
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: buildAppUrl("/login"),
      },
    });
    if (error) {
      return { ok: false, error: "Unable to resend verification email right now. Please try again." };
    }
    return { ok: true, message: "Verification email sent. Check your inbox and spam folder." };
  }, [currentUser?.email]);

  const isSlugAvailable = useCallback(async (slug: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      throw new Error(CONFIG_ERROR_MESSAGE);
    }
    const { data, error } = await supabase.rpc("is_business_slug_available", { slug_input: slug });
    if (error) throw error;
    return data === true;
  }, []);

  const switchBusiness = useCallback((id: string) => {
    const next = businesses.find((business) => business.id === id);
    if (!next || !currentUser) return;
    setSelectedBusiness(next);
    window.localStorage.setItem(`stampee.active-business:${currentUser.id}`, id);
    setStaffAccounts([]);
    void refreshStaffAccountsForBusiness(next.id);
  }, [businesses, currentUser, refreshStaffAccountsForBusiness, setSelectedBusiness]);
  const createBusiness = useCallback(async (payload: { businessName: string; slug: string }): Promise<AuthResult> => {
    if (!currentUser || currentUser.role !== "owner") return { ok: false, error: "Only owners can create businesses." };
    const result = await dbCreateBusiness(payload.businessName, normalizeSlug(payload.slug));
    if (!result.business) return { ok: false, error: result.error ?? "Unable to create this business right now. Please try again." };
    const nextBusinesses = [...businesses.filter((business) => business.id !== result.business!.id), result.business];
    setBusinesses(nextBusinesses);
    setSelectedBusiness(result.business);
    window.localStorage.setItem(`stampee.active-business:${currentUser.id}`, result.business.id);
    setStaffAccounts([]);
    return { ok: true, message: "Business created successfully." };
  }, [businesses, currentUser, setSelectedBusiness]);

  const updateProfileInfo = useCallback(async (payload: {
    businessName?: string; email?: string; slug?: string;
  }): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { ok: false, error: CONFIG_ERROR_MESSAGE };
    }
    if (!currentUser) return { ok: false, error: AUTH_REQUEST_ERROR };

    const nextBusinessName = payload.businessName?.trim();
    if (nextBusinessName && activeBusiness) {
      const { error } = await supabase.rpc("update_business_profile", {
        business_id_input: activeBusiness.id,
        business_name_input: nextBusinessName,
      });
      if (error) return { ok: false, error: PROFILE_UPDATE_ERROR };
      const updatedBusiness = { ...activeBusiness, businessName: nextBusinessName };
      setBusinesses((previous) => previous.map((business) => business.id === updatedBusiness.id ? updatedBusiness : business));
      if (businessSelectionRef.current.id === updatedBusiness.id) setActiveBusiness(updatedBusiness);
    }
    if (payload.email?.trim()) {
      const { error } = await supabase.from("profiles").update({ email: payload.email.trim().toLowerCase() }).eq("id", currentUser.id);
      if (error) return { ok: false, error: PROFILE_UPDATE_ERROR };
      await refreshProfile();
    }
    return { ok: true };
  }, [activeBusiness, currentUser, refreshProfile]);

  const updatePassword = useCallback(async (newPassword: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { ok: false, error: CONFIG_ERROR_MESSAGE };
    }
    if (newPassword.length < 6) {
      return { ok: false, error: "New password must be at least 6 characters." };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: PASSWORD_UPDATE_ERROR };
    return { ok: true };
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { ok: false, error: CONFIG_ERROR_MESSAGE };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: buildAppUrl("/login"),
    });
    if (error) return { ok: false, error: PASSWORD_RESET_ERROR };
    return { ok: true };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      currentOwner,
      businesses,
      activeBusiness,
      switchBusiness,
      createBusiness,
      isOwner: currentUser?.role === "owner",
      isStaff: currentUser?.role === "staff",
      isEmailVerified,
      loading,
      staffAccounts,
      login,
      loginStaff,
      signup,
      loginDemo,
      createStaff,
      updateStaffPin,
      setStaffAccess,
      deleteStaff,
      deleteAccount,
      logout,
      resendVerificationEmail,
      isSlugAvailable,
      updateProfileInfo,
      updatePassword,
      resetPassword,
      refreshProfile,
    }),
    [
      currentUser, currentOwner, businesses, activeBusiness, isEmailVerified, loading, staffAccounts,
      switchBusiness, createBusiness, login, loginStaff, signup, loginDemo, createStaff,
      updateStaffPin, setStaffAccess, deleteStaff, deleteAccount, logout,
      resendVerificationEmail, isSlugAvailable, updateProfileInfo,
      updatePassword, resetPassword, refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
