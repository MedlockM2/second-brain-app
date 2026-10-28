/**
 * PurchasesContext provides subscription state to the entire app.
 *
 * Handles RevenueCat initialization, user identification, and
 * exposes subscription status for paywall gating.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { CustomerInfo } from "react-native-purchases";
import {
  initializePurchases,
  identifyUser,
  logOutUser,
  getCustomerInfo,
  hasActiveEntitlement,
} from "../services/purchaseService";
import { useAuth } from "./AuthContext";
import { apiRequest } from "../services/apiClient";

import type { EntitlementStatus } from "@media-summarizer/core/types/entitlements";
export type { EntitlementStatus } from "@media-summarizer/core/types/entitlements";

interface PurchasesContextValue {
  /** Whether RevenueCat has been initialized */
  isInitialized: boolean;
  /** Current customer info from RevenueCat */
  customerInfo: CustomerInfo | null;
  /** Backend entitlement status */
  entitlementStatus: EntitlementStatus | null;
  /** Whether the user has an active subscription */
  isSubscribed: boolean;
  /**
   * Whether the app may offer a subscription at all (task-429).
   *
   * True while the backend reports the beta regime, **and while it reports
   * nothing**. That second half is deliberate and is the opposite of the rule
   * the rest of this app follows for an unknown plan: here the question is not
   * what to render, it is whether to offer a purchase that cannot be completed.
   * A failed entitlements request is not a reason to send a beta tester to a
   * paywall, so the entries stay hidden until a payload says otherwise.
   */
  isBetaAccess: boolean;
  /** Loading state for subscription checks */
  isLoading: boolean;
  /** Refresh entitlement status from backend */
  refreshEntitlements: () => Promise<void>;
}

const PurchasesContext = createContext<PurchasesContextValue | null>(null);

export function PurchasesProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [entitlementStatus, setEntitlementStatus] =
    useState<EntitlementStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize RevenueCat on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initializePurchases();
        setIsInitialized(true);
      } catch (error) {
        console.error("[PurchasesContext] Failed to initialize RevenueCat:", error);
      }
    };
    init();
  }, []);

  // Identify user with RevenueCat after authentication
  useEffect(() => {
    if (!isInitialized || !isAuthenticated || !user?.id) return;

    const identify = async () => {
      try {
        const info = await identifyUser(user.id);
        setCustomerInfo(info);
      } catch (error) {
        console.error("[PurchasesContext] Failed to identify user:", error);
      }
    };
    identify();
  }, [isInitialized, isAuthenticated, user?.id]);

  // Log out from RevenueCat when user logs out
  useEffect(() => {
    if (!isInitialized || isAuthenticated) return;

    const logout = async () => {
      try {
        await logOutUser();
        setCustomerInfo(null);
        setEntitlementStatus(null);
      } catch (error) {
        // Ignore logout errors
      }
    };
    logout();
  }, [isInitialized, isAuthenticated]);

  // Fetch backend entitlement status
  const refreshEntitlements = useCallback(async () => {
    if (!isAuthenticated) return;

    await Promise.resolve();
    setIsLoading(true);
    try {
      const status = await apiRequest<EntitlementStatus>(
        "/api/entitlements/status",
      );
      setEntitlementStatus(status);
    } catch (error) {
      console.error("[PurchasesContext] Failed to fetch entitlements:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Refresh entitlements when auth changes
  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => void refreshEntitlements(), 0);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, refreshEntitlements]);

  // Also refresh RevenueCat customer info periodically
  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    const refreshCustomerInfo = async () => {
      try {
        const info = await getCustomerInfo();
        setCustomerInfo(info);
      } catch (error) {
        // Non-critical, ignore
      }
    };

    // Refresh on focus or after purchase
    refreshCustomerInfo();
  }, [isInitialized, isAuthenticated]);

  const isSubscribed =
    entitlementStatus?.is_active === true ||
    (customerInfo !== null && hasActiveEntitlement(customerInfo));

  const isBetaAccess =
    entitlementStatus === null || entitlementStatus.is_beta_access;

  const value: PurchasesContextValue = {
    isInitialized,
    customerInfo,
    entitlementStatus,
    isSubscribed,
    isBetaAccess,
    isLoading,
    refreshEntitlements,
  };

  return (
    <PurchasesContext.Provider value={value}>
      {children}
    </PurchasesContext.Provider>
  );
}

/**
 * Hook to access purchases/subscription context. Must be used within PurchasesProvider.
 */
export function usePurchases(): PurchasesContextValue {
  const context = useContext(PurchasesContext);
  if (!context) {
    throw new Error("usePurchases must be used within a PurchasesProvider");
  }
  return context;
}
