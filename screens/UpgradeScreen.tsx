import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  useWindowDimensions,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../context/UserContext";
import { supabase } from "../services/supabaseClient";
import * as IAP from "react-native-iap";

const plans = [
  {
    name: "Basic",
    id: "hde.basic.199",
    price: "199",
    originalPrice: "249",
    type: "once",
    credits: "5 Project Credits",
    color: "#3B82F6", // Blue
    icon: "brush-outline",
    features: [
      "Unlock Interiors, Flooring & Painting",
      "House Plan Access",
      "Save up to 5 unique projects",
      "Standard PDF Cost Reports",
    ],
  },
  {
    name: "Standard",
    id: "hde.standard.349",
    price: "349",
    originalPrice: "499",
    type: "once",
    credits: "10 Project Credits",
    color: "#D9A443", // Gold
    icon: "git-commit",
    badge: "Most Popular",
    features: [
      "Everything in Basic",
      "Unlock Plumbing & Electrical Layouts",
      "Doors & Windows Schedule Tools",
      "Save up to 10 unique projects",
      "Detailed Technical PDF Exports",
    ],
  },
  {
    name: "Pro",
    id: "hde.pro.monthly",
    price: "999",
    originalPrice: "1,427",
    type: "mo",
    credits: "High-Volume Usage",
    color: "#64748B", // Slate
    icon: "ribbon",
    features: [
      "100 Monthly Project Saves",
      "10 Daily Save Limit (Anti-Bot)",
      "Everything in Standard",
      "Material BOQ (Bill of Quantities)",
      "Priority Support",
    ],
  },
];

export const UpgradeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isTablet = width > 768;

  const { user, planTier, refreshProfile } = useUser();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [subscriptionOffers, setSubscriptionOffers] = useState<{ [sku: string]: string }>({});
  const [loading, setLoading] = useState(false);

  const itemSkus = ["hde.basic.199", "hde.standard.349"];
  const subscriptionSkus = ["hde.pro.monthly"];

  useEffect(() => {
    let purchaseUpdateSubscription: any;
    let purchaseErrorSubscription: any;

    const initIAP = async () => {
      try {
        await IAP.initConnection();

        try {
          await IAP.fetchProducts({ skus: itemSkus, type: "in-app" });
          const fetchedSubs = await IAP.fetchProducts({ skus: subscriptionSkus, type: "subs" });
          
          if (fetchedSubs && fetchedSubs.length > 0) {
            const offersMap: { [sku: string]: string } = {};
            fetchedSubs.forEach((sub: any) => {
              if (sub.subscriptionOffers && sub.subscriptionOffers.length > 0) {
                const firstOffer = sub.subscriptionOffers[0];
                if (firstOffer && firstOffer.offerToken) {
                  offersMap[sub.productId] = firstOffer.offerToken;
                }
              }
            });
            setSubscriptionOffers(offersMap);
          }
        } catch (fetchErr) {
          console.warn("Failed to fetch product information from store:", fetchErr);
        }

        purchaseUpdateSubscription = IAP.purchaseUpdatedListener(async (purchase) => {
          const receipt = purchase.purchaseToken;
          if (receipt) {
            try {
              setLoading(true);
              await handlePurchaseSuccess(purchase);
              await IAP.finishTransaction({ purchase, isConsumable: false });
            } catch (err) {
              console.error("Error finishing transaction:", err);
            } finally {
              setLoading(false);
            }
          }
        });

        purchaseErrorSubscription = IAP.purchaseErrorListener((error) => {
          console.warn("Purchase error listener triggered:", error);
          if (error.code !== IAP.ErrorCode.UserCancelled) {
            Alert.alert("Purchase Failed", error.message || "Payment could not be completed.");
          }
        });

      } catch (err) {
        console.warn("IAP connection failed:", err);
      }
    };

    initIAP();

    return () => {
      if (purchaseUpdateSubscription) {
        purchaseUpdateSubscription.remove();
      }
      if (purchaseErrorSubscription) {
        purchaseErrorSubscription.remove();
      }
      IAP.endConnection();
    };
  }, [user]);

  const handlePurchaseSuccess = async (purchase: IAP.Purchase) => {
    if (!user) {
      Alert.alert("Error", "No user logged in. Purchase could not be synced.");
      return;
    }

    let tierName: "basic" | "standard" | "pro" = "basic";
    let creditsCount = 0;

    if (purchase.productId === "hde.pro.monthly") {
      tierName = "pro";
      creditsCount = 100;
    } else if (purchase.productId === "hde.standard.349") {
      tierName = "standard";
      creditsCount = 10;
    } else if (purchase.productId === "hde.basic.199") {
      tierName = "basic";
      creditsCount = 5;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          has_paid: true,
          plan_tier: tierName,
          credits: creditsCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      await refreshProfile();
      
      let successMessage = "";
      if (tierName === "pro") {
        successMessage = "Pro account activated successfully!";
      } else if (tierName === "standard") {
        successMessage = "Credited 10 Projects successfully!";
      } else if (tierName === "basic") {
        successMessage = "Credited 5 Projects successfully!";
      }
      
      Alert.alert("Payment Successful", successMessage);
    } catch (err: any) {
      console.error("Failed to update database profile:", err);
      Alert.alert("Update Error", "Payment was successful, but we failed to sync with the database. Please try using 'Restore Purchases'.");
    }
  };

  const handleBuyPlan = async (planId: string, planType: string) => {
    if (!user) {
      Alert.alert(
        "Authentication Required",
        "Please sign in or sign up before purchasing so we can sync your upgrade layout across your devices.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: () => navigation.navigate("Login") },
        ]
      );
      return;
    }

    try {
      setPurchasingId(planId);
      if (planType === "once") {
        await IAP.requestPurchase({
          request: {
            google: { skus: [planId] },
            apple: { sku: planId }
          },
          type: "in-app"
        });
      } else {
        const offerToken = subscriptionOffers[planId];
        if (Platform.OS === "android" && !offerToken) {
          Alert.alert("Store Error", "Could not retrieve the subscription offer details from Google Play.");
          return;
        }
        await IAP.requestPurchase({
          request: {
            google: {
              skus: [planId],
              subscriptionOffers: [{ sku: planId, offerToken: offerToken || "" }]
            },
            apple: { sku: planId }
          },
          type: "subs"
        });
      }
    } catch (err: any) {
      console.error("In-app purchase request error:", err);
      Alert.alert("Purchase Error", err.message || "Failed to launch native checkout.");
    } finally {
      setPurchasingId(null);
    }
  };

  const handleRestorePurchases = async () => {
    if (!user) {
      Alert.alert("Authentication Required", "Please sign in to restore purchases.");
      return;
    }

    setLoading(true);
    try {
      const purchases = await IAP.getAvailablePurchases();
      if (purchases && purchases.length > 0) {
        let restoredTier: "basic" | "standard" | "pro" | null = null;
        let restoredCredits = 0;

        for (const purchase of purchases) {
          if (purchase.productId === "hde.pro.monthly") {
            restoredTier = "pro";
            restoredCredits = 100;
          } else if (purchase.productId === "hde.standard.349") {
            if (restoredTier !== "pro") {
              restoredTier = "standard";
              restoredCredits = 10;
            }
          } else if (purchase.productId === "hde.basic.199") {
            if (restoredTier !== "pro" && restoredTier !== "standard") {
              restoredTier = "basic";
              restoredCredits = 5;
            }
          }
        }

        if (restoredTier) {
          const { error } = await supabase
            .from("profiles")
            .update({
              has_paid: true,
              plan_tier: restoredTier,
              credits: restoredCredits,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);

          if (error) throw error;
          await refreshProfile();
          Alert.alert("Success", "Your purchases have been successfully restored!");
        } else {
          Alert.alert("No Purchases Found", "No active digital plans were found for your Google account.");
        }
      } else {
        Alert.alert("No Purchases Found", "No active digital plans were found for your Google account.");
      }
    } catch (err: any) {
      console.error("Restore purchase error:", err);
      Alert.alert("Restore Error", err.message || "Failed to restore purchases.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E293B" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Ionicons name="sparkles" size={40} color="#D9A443" style={{ marginBottom: 8 }} />
          <Text style={styles.title}>Choose Your Plan</Text>
          <Text style={styles.subtitle}>
            Get the precision tools you need to build with confidence and save on material costs.
          </Text>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#D9A443" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>What is a credit?</Text>
            <Text style={styles.infoText}>
              1 Credit = 1 Unique Project. Use it to design, calculate, and save a full building plan.
            </Text>
          </View>
        </View>

        {/* Plans Stack */}
        <View style={[styles.plansContainer, isTablet && styles.plansContainerTablet]}>
          {plans.map((plan, idx) => {
            const isActive = planTier === plan.name.toLowerCase();
            return (
              <View key={idx} style={[styles.planCard, plan.badge ? styles.planCardActive : null, isTablet && styles.planCardTablet]}>
                {plan.badge && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{plan.badge}</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <View>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.planPrice}>₹{plan.price}</Text>
                      <Text style={styles.planDuration}>/{plan.type}</Text>
                      <Text style={styles.originalPrice}>₹{plan.originalPrice}</Text>
                    </View>
                  </View>
                  <View style={[styles.iconBox, { backgroundColor: plan.color + "15" }]}>
                    <Ionicons name={plan.icon as any} size={20} color={plan.color} />
                  </View>
                </View>

                <View style={styles.creditBox}>
                  <Text style={[styles.creditText, { color: plan.color }]}>{plan.credits}</Text>
                </View>

                <View style={styles.featuresList}>
                  {plan.features.map((feat, fIdx) => (
                    <View key={fIdx} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 8 }} />
                      <Text style={styles.featureText}>{feat}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.btnBuyPlan,
                    { backgroundColor: plan.color },
                    isActive && styles.btnBuyPlanDisabled
                  ]}
                  onPress={() => handleBuyPlan(plan.id, plan.type === "once" ? "once" : "sub")}
                  disabled={isActive || purchasingId !== null}
                >
                  <Text style={styles.btnBuyPlanText}>
                    {isActive 
                      ? "Current Plan" 
                      : purchasingId === plan.id 
                        ? "Processing..." 
                        : `Buy ${plan.name}`}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={styles.btnRestore} onPress={handleRestorePurchases}>
          <Ionicons name="refresh-circle" size={20} color="#D9A443" style={{ marginRight: 6 }} />
          <Text style={styles.btnRestoreText}>Restore Purchases</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Payments are processed securely via Google Play. Subscription plans will bill monthly and can be managed or canceled anytime in your Play Store Subscription settings.
        </Text>
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#D9A443" />
          <Text style={styles.loadingText}>Syncing payment details...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    padding: 16,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
    textAlign: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 20,
    width: "100%",
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 2,
  },
  infoText: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 15,
  },
  plansContainer: {
    width: "100%",
    marginBottom: 20,
  },
  plansContainerTablet: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    width: "100%",
  },
  planCardTablet: {
    flex: 1,
    marginHorizontal: 6,
    marginBottom: 0,
  },
  planCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 16,
    position: "relative",
  },
  planCardActive: {
    borderColor: "#D9A443",
    borderWidth: 2,
    shadowColor: "#D9A443",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  badgeContainer: {
    position: "absolute",
    top: -10,
    right: 16,
    backgroundColor: "#D9A443",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeText: {
    color: "#1E293B",
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  planName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  planPrice: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1E293B",
  },
  planDuration: {
    fontSize: 11,
    color: "#64748B",
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 12,
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  creditBox: {
    backgroundColor: "#F8FAFC",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  creditText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  featuresList: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  featureText: {
    fontSize: 12,
    color: "#475569",
  },
  btnBuyPlan: {
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  btnBuyPlanDisabled: {
    backgroundColor: "#E2E8F0",
  },
  btnBuyPlanText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  btnRestore: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderWidth: 1,
    flexDirection: "row",
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  btnRestoreText: {
    color: "#1E293B",
    fontSize: 15,
    fontWeight: "bold",
  },
  footerNote: {
    fontSize: 10,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 14,
    paddingHorizontal: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 12,
    fontWeight: "bold",
  },
});

export default UpgradeScreen;
