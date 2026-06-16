import React from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../context/UserContext";

const plans = [
  {
    name: "Basic",
    id: "hde.basic.199",
    price: "199",
    originalPrice: "249",
    type: "once",
    credits: "5 Project Credits",
    color: "#3B82F6",
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
    color: "#D9A443",
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
    id: "hdepro",
    price: "999",
    originalPrice: "1,427",
    type: "once",
    credits: "100 Project Credits",
    color: "#64748B",
    icon: "ribbon",
    features: [
      "100 Project Saves",
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
  const { planTier } = useUser();

  const handleBuyPlan = (planName: string) => {
    Alert.alert(
      "In-App Purchase",
      `To purchase the ${planName} plan, please download and use our official Android or iOS mobile app, where payments are processed securely via Google Play and Apple App Store.`
    );
  };

  const handleRestorePurchases = () => {
    Alert.alert(
      "Restore Purchases",
      "In-App Purchases can only be restored inside the mobile app on your Android or iOS device."
    );
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
              <View key={idx} style={[styles.planCard, (plan.badge || isActive) ? styles.planCardActive : null, isTablet && styles.planCardTablet]}>
                {isActive && (
                  <View style={[styles.badgeContainer, { backgroundColor: "#10B981" }]}>
                    <Text style={styles.badgeText}>Active Tier</Text>
                  </View>
                )}
                {!isActive && plan.badge && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{plan.badge}</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <View>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.planPrice}>₹{plan.price}</Text>
                      <Text style={styles.planDuration}>
                        {plan.type === "once" ? " once" : `/${plan.type}`}
                      </Text>
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
                  style={[styles.btnBuyPlan, { backgroundColor: plan.color }]}
                  onPress={() => handleBuyPlan(plan.name)}
                >
                  <Text style={styles.btnBuyPlanText}>Buy {plan.name}</Text>
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
          Store purchases and upgrades are processed securely via Google Play and Apple App Store in the mobile application.
        </Text>
      </ScrollView>
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
});

export default UpgradeScreen;
