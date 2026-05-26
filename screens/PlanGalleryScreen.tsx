import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  SafeAreaView,
  Linking,
  ScrollView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabaseClient";
import { useUser } from "../context/UserContext";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


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
  displayUrl?: string;
}

interface HousePlanCardProps {
  item: HousePlan;
  isLocked: boolean;
  onPress: (item: HousePlan) => void;
}

const HousePlanCard = React.memo(({ item, isLocked, onPress }: HousePlanCardProps) => {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item)}
      activeOpacity={0.9}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.displayUrl || item.file_url }} style={styles.cardImage} />
        {isLocked && (
          <View style={styles.proBadge}>
            <Ionicons name="lock-closed" size={10} color="#FFFFFF" style={styles.iconMarginRight2} />
            <Text style={styles.proBadgeText}>PRO</Text>
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDim}>{item.dimensions} | {item.area_sqft} sqft</Text>
        <View style={styles.cardMeta}>
          <View style={styles.metaBadge}>
            <Ionicons name="compass" size={14} color="#64748B" style={styles.iconMarginRight4} />
            <Text style={styles.metaBadgeText}>{item.facing} Facing</Text>
          </View>
          <View style={styles.metaBadge}>
            <Ionicons name="layers" size={14} color="#64748B" style={styles.iconMarginRight4} />
            <Text style={styles.metaBadgeText}>{item.floors}</Text>
          </View>
          <View style={styles.metaBadge}>
            <Ionicons name="bed" size={14} color="#64748B" style={styles.iconMarginRight4} />
            <Text style={styles.metaBadgeText}>{item.bedrooms} BHK</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export const PlanGalleryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
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
        const mappedData = data.map((plan: any) => {
          let displayUrl = plan.file_url;
          if (!displayUrl.startsWith("http")) {
            displayUrl = supabase.storage.from("house-plans").getPublicUrl(plan.file_url).data.publicUrl;
          }
          return { ...plan, displayUrl };
        });

        if (clearOld) {
          setPlans(mappedData);
        } else {
          setPlans((prev) => [...prev, ...mappedData]);
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

  const renderItem = useCallback(({ item }: { item: HousePlan }) => {
    const isLocked = !hasPaid && role !== "admin";
    return (
      <HousePlanCard
        item={item}
        isLocked={isLocked}
        onPress={handlePlanPress}
      />
    );
  }, [hasPaid, role, handlePlanPress]);

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={plans}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        ListFooterComponent={() => 
          loading && !refreshing ? <ActivityIndicator style={styles.loader} color="#D9A443" /> : null
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
            <View style={[styles.modalContent, { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 24 }]}>
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
                    uri: selectedPlan.displayUrl || selectedPlan.file_url,
                  }}
                  style={styles.modalImage}
                  contentFit="contain"
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
                    <Ionicons name="logo-youtube" size={20} color="#FFFFFF" style={styles.iconMarginRight8} />
                    <Text style={styles.btnYoutubeText}>Watch House Walkthrough</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>

                {!hasPaid && role !== "admin" ? (
                  <TouchableOpacity
                    style={styles.btnPrimaryLock}
                    onPress={() => {
                      setSelectedPlan(null);
                      navigation.navigate("Upgrade");
                    }}
                  >
                    <Ionicons name="lock-closed" size={18} color="#1E293B" style={styles.iconMarginRight6} />
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
                        <Ionicons name="download" size={18} color="#1E293B" style={styles.iconMarginRight6} />
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


    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  listContent: {
    padding: 10,
    paddingBottom: 80,
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    flex: 0.485,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 4 / 3,
    position: "relative",
    backgroundColor: "#F1F5F9",
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  proBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(217, 164, 67, 0.95)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
    elevation: 3,
  },
  proBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  cardInfo: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 3,
  },
  cardDim: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 2,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  metaBadgeText: {
    fontSize: 10,
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
    flex: 1,
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 24,
    alignSelf: "center",
  },
  btnYoutubeText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 12,
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

  iconMarginRight2: {
    marginRight: 2,
  },
  iconMarginRight4: {
    marginRight: 4,
  },
  iconMarginRight6: {
    marginRight: 6,
  },
  iconMarginRight8: {
    marginRight: 8,
  },
  loader: {
    margin: 16,
  },
});

export default PlanGalleryScreen;
