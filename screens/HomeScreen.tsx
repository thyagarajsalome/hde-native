import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../context/UserContext";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "MainTabs">;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

interface CalculatorItem {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  minTier: number; // 0 = Free, 1 = Basic, 2 = Standard, 3 = Pro
  screen: keyof RootStackParamList;
  params?: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user, hasPaid, planTier, role } = useUser();
  const userTierValue = { free: 0, basic: 1, standard: 2, pro: 3 }[planTier || "free"] || 0;

  const calculators: CalculatorItem[] = [
    {
      id: "construction",
      title: "Construction Cost",
      icon: "home-outline",
      color: "#3B82F6",
      minTier: 0,
      screen: "ConstructionCalculator",
    },
    {
      id: "materials",
      title: "Material Quantity",
      icon: "cube-outline",
      color: "#10B981",
      minTier: 3,
      screen: "MaterialCalculator",
    },
    {
      id: "flooring",
      title: "Flooring Cost",
      icon: "grid-outline",
      color: "#EC4899",
      minTier: 1,
      screen: "OtherCalculator",
      params: { type: "flooring" },
    },
    {
      id: "painting",
      title: "Painting Cost",
      icon: "brush-outline",
      color: "#8B5CF6",
      minTier: 1,
      screen: "OtherCalculator",
      params: { type: "painting" },
    },
    {
      id: "plumbing",
      title: "Plumbing Cost",
      icon: "water-outline",
      color: "#06B6D4",
      minTier: 2,
      screen: "OtherCalculator",
      params: { type: "plumbing" },
    },
    {
      id: "electrical",
      title: "Electrical Cost",
      icon: "flash-outline",
      color: "#F59E0B",
      minTier: 2,
      screen: "OtherCalculator",
      params: { type: "electrical" },
    },
    {
      id: "doors-windows",
      title: "Doors & Windows",
      icon: "log-in-outline",
      color: "#EF4444",
      minTier: 2,
      screen: "OtherCalculator",
      params: { type: "doors-windows" },
    },
    {
      id: "interior",
      title: "Interior Design",
      icon: "color-palette-outline",
      color: "#8D6E63",
      minTier: 1,
      screen: "OtherCalculator",
      params: { type: "interior" },
    },
  ];

  const handlePress = (calc: CalculatorItem) => {
    if (!user && calc.minTier > 0) {
      navigation.navigate("Login");
      return;
    }

    if (userTierValue < calc.minTier) {
      navigation.navigate("Upgrade");
      return;
    }
    
    if (calc.screen === "OtherCalculator") {
      navigation.navigate(calc.screen, calc.params);
    } else {
      navigation.navigate(calc.screen as any);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E293B" />
      
      {/* Small, Compact Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image 
            source={require("../assets/images/logo.png")} 
            style={styles.logo} 
            resizeMode="contain" 
          />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>HDE</Text>
            <Text style={styles.headerSubtitle}>A Guide to Build Dream Home & Estimation Platform</Text>
          </View>
        </View>
        {!user ? (
          <TouchableOpacity 
            style={styles.badgeProUpgrade} 
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.badgeProUpgradeText}>Sign In</Text>
          </TouchableOpacity>
        ) : hasPaid ? (
          <View style={styles.badgeProActive}>
            <Text style={styles.badgeProActiveText}>{planTier.toUpperCase()}</Text>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.badgeProUpgrade} 
            onPress={() => navigation.navigate("Upgrade")}
          >
            <Text style={styles.badgeProUpgradeText}>Go PRO</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Grid of Calculators (2-column wrap) */}
      <View style={styles.grid}>
        {calculators.map((calc) => {
          const isLocked = userTierValue < calc.minTier;
          const tierNames = ["Free", "Basic", "Standard", "Pro"];
          const targetTierName = tierNames[calc.minTier];

          return (
            <TouchableOpacity
              key={calc.id}
              style={styles.card}
              onPress={() => handlePress(calc)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: calc.color + "12" }]}>
                <Ionicons name={calc.icon} size={20} color={calc.color} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={1}>{calc.title}</Text>
                {calc.minTier > 0 && (
                  <View style={styles.badgeRow}>
                    <Ionicons 
                      name={isLocked ? "lock-closed" : "checkmark-circle"} 
                      size={9} 
                      color={isLocked ? "#EF4444" : "#10B981"} 
                      style={{ marginRight: 2 }}
                    />
                    <Text style={[styles.premiumText, isLocked ? null : styles.premiumTextPaid]}>
                      {isLocked ? targetTierName.toUpperCase() : "Unlocked"}
                    </Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={12} color="#94A3B8" />
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E293B",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 8,
  },
  logo: {
    width: 28,
    height: 28,
  },
  headerTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 8,
    color: "#94A3B8",
    marginTop: 1,
  },
  badgeProActive: {
    backgroundColor: "#D9A443",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeProActiveText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  badgeProUpgrade: {
    backgroundColor: "#D9A443",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  badgeProUpgradeText: {
    color: "#1E293B",
    fontSize: 10,
    fontWeight: "bold",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 10,
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1E293B",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  premiumText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#EF4444",
  },
  premiumTextPaid: {
    color: "#10B981",
  },
});

export default HomeScreen;
