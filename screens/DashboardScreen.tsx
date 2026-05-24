import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../context/UserContext";
import { supabase } from "../services/supabaseClient";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useFocusEffect } from "@react-navigation/native";

type DashboardScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "MainTabs">;

interface DashboardScreenProps {
  navigation: DashboardScreenNavigationProp;
}

interface Project {
  id: string;
  name: string;
  type: string;
  data: any;
  date: string;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { user, role, credits, planTier, hasPaid, signOut, refreshProfile } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Admin states
  const [unverifiedPros, setUnverifiedPros] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  const fetchSavedProjects = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) throw error;
      if (data) setProjects(data);
    } catch (error: any) {
      console.error("Error fetching projects:", error);
      Alert.alert("Error", "Failed to fetch saved projects.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUnverifiedPros = async () => {
    if (role !== "admin") return;
    setAdminLoading(true);
    try {
      const { data, error } = await supabase
        .from("professionals")
        .select("*")
        .or("is_verified.eq.false,is_verified.is.null")
        .order("name");

      if (error) throw error;
      setUnverifiedPros(data || []);
    } catch (err) {
      console.error("Error fetching unverified pros:", err);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleVerifyPro = async (proId: string) => {
    try {
      const { error } = await supabase
        .from("professionals")
        .update({ is_verified: true })
        .eq("id", proId);

      if (error) throw error;
      setUnverifiedPros((prev) => prev.filter((p) => p.id !== proId));
      Alert.alert("Success", "Professional verified successfully.");
    } catch (err: any) {
      console.error("Error verifying pro:", err);
      Alert.alert("Error", "Failed to verify professional.");
    }
  };

  const handleRejectPro = async (proId: string, proName: string) => {
    Alert.alert(
      "Confirm Deletion",
      `Are you sure you want to permanently delete the professional directory listing for "${proName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Listing",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.from("professionals").delete().eq("id", proId);
              if (error) throw error;
              setUnverifiedPros((prev) => prev.filter((p) => p.id !== proId));
              Alert.alert("Deleted", "Listing deleted successfully.");
            } catch (err: any) {
              console.error("Error deleting pro:", err);
              Alert.alert("Error", "Failed to delete listing.");
            }
          },
        },
      ]
    );
  };

  // Re-run whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchSavedProjects();
        refreshProfile();
        if (role === "admin") {
          fetchUnverifiedPros();
        }
      }
    }, [user, role])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSavedProjects();
    refreshProfile();
    if (role === "admin") {
      fetchUnverifiedPros();
    }
  };

  const handleDeleteProject = (projectId: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this saved project?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.from("projects").delete().eq("id", projectId);
              if (error) throw error;
              setProjects((prev) => prev.filter((p) => p.id !== projectId));
              Alert.alert("Success", "Project deleted successfully.");
            } catch (err: any) {
              console.error("Delete project error:", err);
              Alert.alert("Error", "Failed to delete project.");
            }
          },
        },
      ]
    );
  };

  const handleProjectPress = (project: Project) => {
    const screenParams = { projectData: project.data, projectName: project.name };
    if (project.type === "construction") {
      navigation.navigate("ConstructionCalculator", screenParams);
    } else if (project.type === "materials") {
      navigation.navigate("MaterialCalculator", screenParams);
    } else {
      navigation.navigate("OtherCalculator", { type: project.type, ...screenParams });
    }
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined) return "";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const renderProjectItem = ({ item }: { item: Project }) => {
    let iconName: keyof typeof Ionicons.glyphMap = "calculator-outline";
    let iconColor = "#3B82F6";

    if (item.type === "construction") {
      iconName = "home";
      iconColor = "#3B82F6";
    } else if (item.type === "materials") {
      iconName = "cube";
      iconColor = "#10B981";
    } else if (item.type === "flooring") {
      iconName = "grid";
      iconColor = "#EC4899";
    } else if (item.type === "painting") {
      iconName = "brush";
      iconColor = "#8B5CF6";
    }

    return (
      <View style={styles.projectCard}>
        <TouchableOpacity
          style={styles.projectMain}
          onPress={() => handleProjectPress(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.projectIconContainer, { backgroundColor: iconColor + "10" }]}>
            <Ionicons name={iconName} size={22} color={iconColor} />
          </View>
          <View style={styles.projectInfo}>
            <Text style={styles.projectName}>{item.name}</Text>
            <Text style={styles.projectMeta}>
              {item.type.charAt(0).toUpperCase() + item.type.slice(1)} • {new Date(item.date).toLocaleDateString("en-IN")}
            </Text>
            {item.data?.totalCost !== undefined && (
              <Text style={styles.projectCost}>{formatCurrency(item.data.totalCost)}</Text>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnDelete}
          onPress={() => handleDeleteProject(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    );
  };

  // Guest view
  if (!user) {
    return (
      <SafeAreaView style={styles.guestContainer}>
        <View style={styles.guestContent}>
          <Ionicons name="lock-open-outline" size={64} color="#94A3B8" style={{ marginBottom: 20 }} />
          <Text style={styles.guestTitle}>Save & Sync Your Projects</Text>
          <Text style={styles.guestSubtitle}>
            Log in to HDE to save estimates, load previously configured budgets, and unlock PDF reports.
          </Text>
          <TouchableOpacity
            style={styles.btnLogin}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.btnLoginText}>Sign In / Register</Text>
          </TouchableOpacity>

          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => navigation.navigate("AboutUs")}>
              <Text style={styles.legalLinkText}>About Us</Text>
            </TouchableOpacity>
            <Text style={styles.legalDivider}>•</Text>
            <TouchableOpacity onPress={() => navigation.navigate("PrivacyPolicy")}>
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalDivider}>•</Text>
            <TouchableOpacity onPress={() => navigation.navigate("TermsOfService")}>
              <Text style={styles.legalLinkText}>Terms</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Profile Section */}
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.userBadge}>
            <Ionicons name="person" size={28} color="#D9A443" />
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
            <View style={styles.tierRow}>
              <Text style={styles.planTierText}>
                Plan: <Text style={styles.planHighlight}>{planTier.toUpperCase()}</Text>
              </Text>
              {!hasPaid && (
                <TouchableOpacity onPress={() => navigation.navigate("Upgrade")}>
                  <Text style={styles.upgradeLink}>Upgrade</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{credits}</Text>
            <Text style={styles.statLbl}>Credits Left</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{projects.length}</Text>
            <Text style={styles.statLbl}>Saved Projects</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.btnPro}
          onPress={() => navigation.navigate("ProRegistration")}
        >
          <Ionicons name="business" size={16} color="#1E293B" style={{ marginRight: 6 }} />
          <Text style={styles.btnProText}>Manage Professional Listing</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSignOut} onPress={signOut}>
          <Ionicons name="log-out-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.btnSignOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Admin Panel Section */}
      {role === "admin" && (
        <View style={styles.adminCard}>
          <View style={styles.adminHeaderRow}>
            <Ionicons name="shield-checkmark" size={18} color="#D9A443" style={{ marginRight: 6 }} />
            <Text style={styles.adminTitle}>Admin Verification Portal</Text>
          </View>

          {adminLoading ? (
            <ActivityIndicator color="#D9A443" style={{ margin: 12 }} />
          ) : unverifiedPros.length === 0 ? (
            <Text style={styles.noUnverifiedText}>No pending professional verifications.</Text>
          ) : (
            <FlatList
              data={unverifiedPros}
              keyExtractor={(item) => item.id}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.unverifiedProCard}>
                  <Text style={styles.unverifiedName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.unverifiedCategory} numberOfLines={1}>{item.category}</Text>
                  <Text style={styles.unverifiedCity} numberOfLines={1}>{item.city}</Text>
                  <View style={styles.adminActionRow}>
                    <TouchableOpacity
                      style={[styles.adminBtn, styles.btnVerify]}
                      onPress={() => handleVerifyPro(item.id)}
                    >
                      <Text style={styles.btnVerifyText}>Verify</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.adminBtn, styles.btnReject]}
                      onPress={() => handleRejectPro(item.id, item.name)}
                    >
                      <Text style={styles.btnRejectText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              contentContainerStyle={styles.adminListContent}
            />
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>My Saved Estimates</Text>

      {/* Projects List */}
      <FlatList
        data={projects}
        renderItem={renderProjectItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        ListEmptyComponent={() =>
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={44} color="#94A3B8" />
              <Text style={styles.emptyText}>You haven't saved any estimates yet.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  guestContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  guestContent: {
    alignItems: "center",
    width: "100%",
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 8,
  },
  guestSubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  btnLogin: {
    backgroundColor: "#1E293B",
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    width: "80%",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 48,
  },
  btnLoginText: {
    color: "#D9A443",
    fontSize: 15,
    fontWeight: "bold",
  },
  legalLinks: {
    flexDirection: "row",
    alignItems: "center",
  },
  legalLinkText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  legalDivider: {
    fontSize: 12,
    color: "#CBD5E1",
    marginHorizontal: 8,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  userBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  profileMeta: {
    flex: 1,
  },
  userEmail: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1E293B",
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  planTierText: {
    fontSize: 12,
    color: "#64748B",
  },
  planHighlight: {
    color: "#D9A443",
    fontWeight: "bold",
  },
  upgradeLink: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#3B82F6",
    marginLeft: 8,
    textDecorationLine: "underline",
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statVal: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 2,
  },
  statLbl: {
    fontSize: 10,
    color: "#64748B",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  btnSignOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    height: 36,
    borderRadius: 8,
  },
  btnSignOutText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
    marginHorizontal: 16,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  projectCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 10,
  },
  projectMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  projectIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 2,
  },
  projectMeta: {
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 4,
  },
  projectCost: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#475569",
  },
  btnDelete: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 8,
  },
  btnPro: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    height: 40,
    borderRadius: 8,
    marginBottom: 10,
  },
  btnProText: {
    color: "#1E293B",
    fontSize: 13,
    fontWeight: "bold",
  },
  adminCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  adminHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    paddingBottom: 8,
  },
  adminTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  noUnverifiedText: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    marginVertical: 12,
  },
  adminListContent: {
    paddingVertical: 4,
  },
  unverifiedProCard: {
    backgroundColor: "#334155",
    borderRadius: 12,
    padding: 12,
    width: 180,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#475569",
  },
  unverifiedName: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  unverifiedCategory: {
    fontSize: 11,
    color: "#D9A443",
    fontWeight: "600",
    marginBottom: 2,
  },
  unverifiedCity: {
    fontSize: 10,
    color: "#94A3B8",
    marginBottom: 8,
  },
  adminActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  adminBtn: {
    flex: 1,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  btnVerify: {
    backgroundColor: "#10B981",
    marginRight: 4,
  },
  btnVerifyText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  btnReject: {
    backgroundColor: "#EF4444",
    marginLeft: 4,
  },
  btnRejectText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
});

export default DashboardScreen;
