import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  SafeAreaView,
  Linking,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabaseClient";
import { useUser } from "../context/UserContext";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useFocusEffect } from "@react-navigation/native";


interface HousePlan {
  id: string;
  title: string;
  area_sqft: number;
  facing: string;
  file_url: string;
  dimensions: string;
  floors: string;
  bedrooms: number;
  bathrooms: number;
  parking: string;
  description: string;
  youtube_url?: string;
}

export const PlanGalleryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [plans, setPlans] = useState<HousePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<HousePlan | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { hasPaid, role } = useUser();
  const PLANS_PER_PAGE = 10;

  const fetchPlans = useCallback(async (pageNum: number, clearOld = false) => {
    if (loading) return;
    setLoading(true);
    const from = pageNum * PLANS_PER_PAGE;
    const to = from + PLANS_PER_PAGE - 1;

    try {
      const { data, error } = await supabase
        .from("house_plans")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (data) {
        if (clearOld) {
          setPlans(data);
        } else {
          setPlans((prev) => [...prev, ...data]);
        }
        setHasMore(data.length === PLANS_PER_PAGE);
      }
    } catch (error: any) {
      console.error("Error fetching plans:", error);
      Alert.alert("Error", "Failed to load house plans.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setPage(0);
      fetchPlans(0, true);
    }, [])
  );

  const handleDeletePlan = async (plan: HousePlan) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to permanently delete "${plan.title}" from the database and storage?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Plan",
          style: "destructive",
          onPress: async () => {
            setSelectedPlan(null);
            setLoading(true);
            try {
              // 1. Delete from database
              const { error: dbError } = await supabase
                .from("house_plans")
                .delete()
                .eq("id", plan.id);

              if (dbError) throw dbError;

              // 2. Remove file from storage
              let relativePath = plan.file_url;
              if (relativePath.includes("/house-plans/")) {
                relativePath = relativePath.split("/house-plans/")[1].replace(/^\/+/, "");
              }
              relativePath = relativePath.replace(/^\/+/, "");

              const { error: storageError } = await supabase.storage
                .from("house-plans")
                .remove([relativePath]);

              if (storageError) {
                console.error("Storage deletion error:", storageError);
              }

              // 3. Update local state
              setPlans((prev) => prev.filter((p) => p.id !== plan.id));
              Alert.alert("Success", "House plan deleted successfully.");
            } catch (err: any) {
              console.error("Delete plan error:", err);
              Alert.alert("Error", err.message || "Failed to delete plan.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(0);
    fetchPlans(0, true);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPlans(nextPage);
    }
  };

  const handlePlanPress = (plan: HousePlan) => {
    setSelectedPlan(plan);
  };

  const handleDownload = async (plan: HousePlan) => {
    if (!hasPaid && role !== "admin") {
      setSelectedPlan(null);
      navigation.navigate("Upgrade");
      return;
    }

    setDownloadingId(plan.id);
    try {
      const filename = plan.title.replace(/\s+/g, "_") + ".jpg";
      const fileUri = (FileSystem as any).documentDirectory + filename;

      // Resolve the relative file URL to a public downloadable URL if needed
      let finalUrl = plan.file_url;
      if (!finalUrl.startsWith("http")) {
        finalUrl = supabase.storage.from("house-plans").getPublicUrl(plan.file_url).data.publicUrl;
      }

      const { uri } = await FileSystem.downloadAsync(finalUrl, fileUri);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert("Success", "Plan downloaded to device: " + uri);
      }
    } catch (err) {
      console.error("Download error:", err);
      Alert.alert("Error", "Failed to download the plan sheet.");
    } finally {
      setDownloadingId(null);
    }
  };

  const openYouTube = (url?: string) => {
    if (url) {
      Linking.openURL(url).catch((err) => console.error("Couldn't open Youtube", err));
    }
  };

  const renderItem = ({ item }: { item: HousePlan }) => {
    const isLocked = !hasPaid && role !== "admin";

    // Resolve public URL for display
    let displayUrl = item.file_url;
    if (!displayUrl.startsWith("http")) {
      displayUrl = supabase.storage.from("house-plans").getPublicUrl(item.file_url).data.publicUrl;
    }

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handlePlanPress(item)}
        activeOpacity={0.9}
      >
        <View style={styles.imageContainer}>
          <Image source={{ uri: displayUrl }} style={styles.cardImage} blurRadius={isLocked ? 12 : 0} />
          {isLocked && (
            <View style={styles.lockedOverlay}>
              <Ionicons name="lock-closed" size={24} color="#FFFFFF" />
              <Text style={styles.lockedText}>Unlocked with Pro Plan</Text>
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDim}>{item.dimensions} | {item.area_sqft} sqft</Text>
          <View style={styles.cardMeta}>
            <View style={styles.metaBadge}>
              <Ionicons name="compass" size={14} color="#64748B" style={{ marginRight: 4 }} />
              <Text style={styles.metaBadgeText}>{item.facing} Facing</Text>
            </View>
            <View style={styles.metaBadge}>
              <Ionicons name="layers" size={14} color="#64748B" style={{ marginRight: 4 }} />
              <Text style={styles.metaBadgeText}>{item.floors}</Text>
            </View>
            <View style={styles.metaBadge}>
              <Ionicons name="bed" size={14} color="#64748B" style={{ marginRight: 4 }} />
              <Text style={styles.metaBadgeText}>{item.bedrooms} BHK</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={plans}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() => 
          loading && !refreshing ? <ActivityIndicator style={{ margin: 16 }} color="#D9A443" /> : null
        }
        ListEmptyComponent={() =>
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyText}>No house plans found.</Text>
            </View>
          ) : null
        }
      />

      {/* Plan Detail Modal */}
      {selectedPlan && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setSelectedPlan(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedPlan.title}
                </Text>
                <TouchableOpacity onPress={() => setSelectedPlan(null)} style={styles.btnClose}>
                  <Ionicons name="close" size={24} color="#1E293B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                <Image
                  source={{
                    uri: selectedPlan.file_url.startsWith("http")
                      ? selectedPlan.file_url
                      : supabase.storage.from("house-plans").getPublicUrl(selectedPlan.file_url).data.publicUrl,
                  }}
                  style={styles.modalImage}
                  resizeMode="contain"
                  blurRadius={!hasPaid && role !== "admin" ? 16 : 0}
                />

                <View style={styles.modalSpecs}>
                  <View style={styles.specCell}>
                    <Text style={styles.specVal}>{selectedPlan.area_sqft} sqft</Text>
                    <Text style={styles.specLbl}>Area</Text>
                  </View>
                  <View style={styles.specCell}>
                    <Text style={styles.specVal}>{selectedPlan.dimensions}</Text>
                    <Text style={styles.specLbl}>Dimensions</Text>
                  </View>
                  <View style={styles.specCell}>
                    <Text style={styles.specVal}>{selectedPlan.facing}</Text>
                    <Text style={styles.specLbl}>Facing</Text>
                  </View>
                  <View style={styles.specCell}>
                    <Text style={styles.specVal}>{selectedPlan.bedrooms} BHK</Text>
                    <Text style={styles.specLbl}>Bedrooms</Text>
                  </View>
                </View>

                <Text style={styles.descTitle}>Description</Text>
                <Text style={styles.descText}>{selectedPlan.description || "No description provided."}</Text>

                {selectedPlan.youtube_url && (
                  <TouchableOpacity
                    style={styles.btnYoutube}
                    onPress={() => openYouTube(selectedPlan.youtube_url)}
                  >
                    <Ionicons name="logo-youtube" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.btnYoutubeText}>Watch House Walkthrough</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                {role === "admin" && (
                  <TouchableOpacity
                    style={styles.btnDeletePlan}
                    onPress={() => handleDeletePlan(selectedPlan)}
                  >
                    <Ionicons name="trash" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.btnDeletePlanText}>Delete Plan Entirely</Text>
                  </TouchableOpacity>
                )}

                {!hasPaid && role !== "admin" ? (
                  <TouchableOpacity
                    style={styles.btnPrimaryLock}
                    onPress={() => {
                      setSelectedPlan(null);
                      navigation.navigate("Upgrade");
                    }}
                  >
                    <Ionicons name="lock-closed" size={18} color="#1E293B" style={{ marginRight: 6 }} />
                    <Text style={styles.btnPrimaryLockText}>Unlock Download with PRO</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.btnPrimary}
                    onPress={() => handleDownload(selectedPlan)}
                    disabled={downloadingId !== null}
                  >
                    {downloadingId ? (
                      <ActivityIndicator color="#1E293B" />
                    ) : (
                      <>
                        <Ionicons name="download" size={18} color="#1E293B" style={{ marginRight: 6 }} />
                        <Text style={styles.btnPrimaryText}>Share & Download Plan</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {role === "admin" && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate("PlanUploader")}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#1E293B" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 9 / 16,
    position: "relative",
    backgroundColor: "#F1F5F9",
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  lockedText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 8,
  },
  cardInfo: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  cardDim: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 12,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginRight: 10,
  },
  metaBadgeText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "90%",
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E293B",
    maxWidth: "80%",
  },
  btnClose: {
    padding: 4,
  },
  modalScroll: {
    padding: 20,
  },
  modalImage: {
    width: "100%",
    height: 300,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    marginBottom: 20,
  },
  modalSpecs: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
  },
  specCell: {
    alignItems: "center",
    flex: 1,
  },
  specVal: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  specLbl: {
    fontSize: 10,
    color: "#64748B",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  descTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 8,
  },
  descText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
    marginBottom: 20,
  },
  btnYoutube: {
    backgroundColor: "#FF0000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  btnYoutubeText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  btnPrimary: {
    backgroundColor: "#D9A443",
    flexDirection: "row",
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  btnPrimaryText: {
    color: "#1E293B",
    fontSize: 15,
    fontWeight: "bold",
  },
  btnPrimaryLock: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FEE2E2",
    borderWidth: 1,
    flexDirection: "row",
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  btnPrimaryLockText: {
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "bold",
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#D9A443",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  btnDeletePlan: {
    backgroundColor: "#EF4444",
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  btnDeletePlanText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },
});

export default PlanGalleryScreen;
