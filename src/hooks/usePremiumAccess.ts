import { useAuth } from '../context/AuthContext';
import { isOwnerAccount } from '../services/ownerAuth';
import { getStoredOwnerKey } from '../services/referralTracking';

export interface PremiumAccessResult {
  isPremiumSubscriber: boolean;
  userRole: string;
  isOwner: boolean;
  canAccessFeature: (featureKey?: string) => boolean;
  upgradeToPremium: () => Promise<void>;
}

/**
 * Custom hook to verify if the current user has a verified 'premium' role
 * in their Firestore user profile.
 * 
 * Strict condition:
 * - Only users with `role: 'premium'` (or 'admin' / platform owner) are granted access.
 * - Non-premium users will have `isPremiumSubscriber: false`.
 */
export function usePremiumAccess(): PremiumAccessResult {
  const { user, profile } = useAuth();

  const isOwner = isOwnerAccount(
    user?.email || (profile as any)?.email,
    profile?.visitorName || profile?.appUsername,
    getStoredOwnerKey()
  );

  // Strictly check Firestore user profile role (issued by server/admin only)
  const firestoreRole = profile?.role;
  const isFirestorePremium =
    firestoreRole === 'premium' ||
    firestoreRole === 'admin' ||
    profile?.subscriptionTier === 'premium' ||
    (profile?.isPremium === true && firestoreRole !== 'free' && firestoreRole !== 'standard');

  const isPremiumSubscriber = Boolean(isOwner || isFirestorePremium);

  const canAccessFeature = (_featureKey?: string): boolean => {
    return isPremiumSubscriber;
  };

  const upgradeToPremium = async (): Promise<void> => {
    throw new Error(
      'Premium access requires verified payment confirmation or administrator approval and cannot be self-activated from the browser.'
    );
  };

  return {
    isPremiumSubscriber,
    userRole: firestoreRole || (isOwner ? 'owner' : 'standard'),
    isOwner,
    canAccessFeature,
    upgradeToPremium,
  };
}
