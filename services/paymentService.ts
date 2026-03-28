import { supabase } from '../lib/supabase';
import { PackageType, PackageStatus } from '../types';

/**
 * Executes a simulated backend database fulfillment for local development.
 * 
 * > [!WARNING]
 * > **SECURITY RISK**: Do NOT use this in production. Production payments 
 * > MUST be fulfilled by a secure Edge Webhook utilizing the `service_role` key. 
 * > Standard Row Level Security (RLS) on the `profiles` table will inherently 
 * > block this function from executing in a live environment.
 * 
 * @param userId - The UUID of the authenticated Supabase user.
 * @param updates - The billing fields to patch onto the user's `profiles` row.
 * @param transactionLog - The official receipt to record in `package_transactions`.
 * @throws Will throw if Supabase RLS policies block the update or insert.
 */
export const applyMockLocalFulfillmentDB = async (
    userId: string,
    updates: {
        package_type: PackageType;
        package_status: PackageStatus;
        package_start_date: string;
        package_end_date: string;
        agent_credits: number;
    },
    transactionLog: {
        user_id: string;
        package_type: PackageType;
        amount: number;
        payment_provider: string;
    }
) => {
    // 1. Update Profile Layer
    const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

    if (profileError) throw profileError;

    // 2. Insert Transaction Log Layer
    const { error: transactionError } = await supabase
        .from('package_transactions')
        .insert([transactionLog]);
        
    if (transactionError) throw transactionError;
};

/**
 * Evaluates the hierarchical business logic for package purchases. 
 * If a user with an active subscription buys a complementary package 
 * (e.g., matching SNEHI with TALKS), their tier is automatically merged into BOTH.
 * 
 * @example
 * ```ts
 * const oldTier = PackageType.TALKS; // User owns TALKS
 * const newlyPaidTier = PackageType.SNEHI; // User buys SNEHI
 *
 * const finalTier = resolveUpgradedPackage(oldTier, newlyPaidTier);
 * console.log(finalTier); // Outputs: PackageType.BOTH
 * ```
 * 
 * @param currentType - The user's currently active subscription tier.
 * @param purchasedType - The specific package the user is currently paying for.
 * @returns The final derived `PackageType` the user should possess post-purchase.
 */
export const resolveUpgradedPackage = (currentType: PackageType | undefined, purchasedType: PackageType): PackageType => {
    if (currentType === PackageType.BOTH || purchasedType === PackageType.BOTH) return PackageType.BOTH;
    if (currentType === PackageType.TALKS && purchasedType === PackageType.SNEHI) return PackageType.BOTH;
    if (currentType === PackageType.SNEHI && purchasedType === PackageType.TALKS) return PackageType.BOTH;
    return purchasedType || PackageType.NONE;
};

/**
 * Calculates the amount of Agent conversation time (credits) a user earns by spending money.
 * Note that only SIMPLISH SNEHI packages inherently grant these time credits.
 * 
 * @example
 * ```ts
 * const baseCost = 499; // ₹499
 * const minuteRate = 2.0; // ₹2.0 per minute
 * 
 * const earnedCredits = calculateBonusCredits(PackageType.SNEHI, baseCost, minuteRate);
 * console.log(earnedCredits); // Outputs: 249
 * ```
 * 
 * @param purchasedType - The package being bought. Only `PackageType.SNEHI` yields credits.
 * @param moneySpent - The total monetary amount spent in base currency (e.g., INR ₹).
 * @param rate - The exchange rate (cost in currency per 1 minute of agent conversation). 
 * @returns The rounded-down integer quantity of total bonus credits earned. 
 */
export const calculateBonusCredits = (purchasedType: PackageType, moneySpent: number, rate: number): number => {
    // SNEHI packages provide minutes converted via rate. 
    // Return 0 if rate corrupts to sub-zero or it's not a SNEHI product.
    if (purchasedType !== PackageType.SNEHI || rate <= 0) return 0;
    return Math.floor(moneySpent / rate);
};
