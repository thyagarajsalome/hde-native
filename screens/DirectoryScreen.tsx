import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  SafeAreaView,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabaseClient";
import { useUser } from "../context/UserContext";

interface Professional {
  id: string;
  name: string;
  category: string;
  city: string;
  area?: string;
  contact_number?: string;
  whatsapp_number?: string;
  years_of_experience?: number;
  is_verified?: boolean;
  bio?: string;
  email?: string;
}

const CATEGORIES = [
  "All Categories",
  "Architect",
  "Structural Engineer",
  "House Contractor",
  "3D Designer / Visualizer",
  "Interior Designer",
  "Electrician",
  "Plumber",
  "Painter",
  "Carpenter",
  "Draftsman",
  "Material Vendor",
];

export const DirectoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useUser();
  const [pros, setPros] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [searchCity, setSearchCity] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [alertModal, setAlertModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: { text: string; onPress?: () => void; isPrimary?: boolean }[];
  }>({
    visible: false,
    title: "",
    message: "",
    buttons: [],
  });

  const showAlert = (title: string, message: string, buttons?: { text: string; onPress?: () => void; isPrimary?: boolean }[]) => {
    setAlertModal({
      visible: true,
      title,
      message,
      buttons: buttons || [{ text: "OK", onPress: () => setAlertModal(prev => ({ ...prev, visible: false })) }],
    });
  };

  const PAGE_SIZE = 10;

  const fetchPros = useCallback(async (pageNum: number, clearOld = false) => {
    if (loading) return;
    setLoading(true);

    try {
      let query = supabase
        .from("professionals")
        .select("*", { count: "exact" })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (selectedCategory !== "All Categories") {
        query = query.eq("category", selectedCategory);
      }

      if (searchCity.trim() !== "") {
        query = query.ilike("city", `%${searchCity.trim()}%`);
      }

      const { data, error } = await query.order("is_verified", { ascending: false });

      if (error) throw error;

      if (data) {
        if (clearOld) {
          setPros(data);
        } else {
          setPros((prev) => [...prev, ...data]);
        }
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (err: any) {
      console.error("Error fetching professionals:", err);
      showAlert("Error", "Failed to retrieve local professionals.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, searchCity]);

  useEffect(() => {
    setPage(0);
    fetchPros(0, true);
  }, [selectedCategory]);

  const handleSearch = () => {
    setPage(0);
    fetchPros(0, true);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(0);
    fetchPros(0, true);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPros(nextPage);
    }
  };

  const contactPro = (phone?: string) => {
    if (!user) {
      showAlert(
        "Sign In Required",
        "Please sign in to view contact details and call this professional.",
        [
          { text: "Cancel", onPress: () => setAlertModal(prev => ({ ...prev, visible: false })) },
          { 
            text: "Sign In", 
            onPress: () => {
              setAlertModal(prev => ({ ...prev, visible: false }));
              navigation.navigate("Login");
            },
            isPrimary: true
          }
        ]
      );
      return;
    }
    if (!phone) {
      showAlert("Unavailable", "This professional has not listed a contact number.");
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      showAlert("Error", "Could not initiate call on your device.");
    });
  };

  const contactWhatsapp = (phone?: string, name?: string) => {
    if (!user) {
      showAlert(
        "Sign In Required",
        "Please sign in to view contact details and message this professional on WhatsApp.",
        [
          { text: "Cancel", onPress: () => setAlertModal(prev => ({ ...prev, visible: false })) },
          { 
            text: "Sign In", 
            onPress: () => {
              setAlertModal(prev => ({ ...prev, visible: false }));
              navigation.navigate("Login");
            },
            isPrimary: true
          }
        ]
      );
      return;
    }
    if (!phone) {
      showAlert("Unavailable", "This professional has not listed a contact number.");
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(`Hello ${name || ""}, I found your contact listing on Home Design English (HDE).`);
    Linking.openURL(`https://wa.me/${cleanPhone.startsWith("91") ? cleanPhone : "91" + cleanPhone}?text=${msg}`).catch(() => {
      showAlert("Error", "Could not open WhatsApp on your device.");
    });
  };

  const renderItem = ({ item }: { item: Professional }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{(item.name[0] || "P").toUpperCase()}</Text>
          </View>
          <View style={styles.mainInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{item.name}</Text>
              {item.is_verified && (
                <Ionicons name="checkmark-done-circle" size={16} color="#10B981" style={{ marginLeft: 6 }} />
              )}
            </View>
            <Text style={styles.category}>{item.category}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.detailRow}>
            <Ionicons name="location" size={14} color="#64748B" style={styles.detailIcon} />
            <Text style={styles.detailText}>{item.area ? `${item.area}, ${item.city}` : item.city}</Text>
          </View>
          {item.years_of_experience !== undefined && (
            <View style={styles.detailRow}>
              <Ionicons name="ribbon" size={14} color="#64748B" style={styles.detailIcon} />
              <Text style={styles.detailText}>{item.years_of_experience} Years Experience</Text>
            </View>
          )}
          {item.bio && (
            <Text style={styles.descText} numberOfLines={2}>{item.bio}</Text>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btnAction, styles.btnCall]}
            onPress={() => contactPro(item.contact_number)}
          >
            <Ionicons name="call" size={16} color="#1E293B" style={{ marginRight: 6 }} />
            <Text style={styles.btnTextCall}>Call Pro</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnAction, styles.btnChat]}
            onPress={() => contactWhatsapp(item.contact_number, item.name)}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.btnTextChat}>WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Filter Options */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchWrapper}>
            <Ionicons name="location" size={20} color="#64748B" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder="Search by City (e.g. Bengaluru)"
              placeholderTextColor="#94A3B8"
              value={searchCity}
              onChangeText={setSearchCity}
              onSubmitEditing={handleSearch}
            />
          </View>
          <TouchableOpacity style={styles.btnSearch} onPress={handleSearch}>
            <Ionicons name="search" size={20} color="#1E293B" />
          </TouchableOpacity>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategory === item ? styles.categoryChipActive : null,
              ]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === item ? styles.categoryChipTextActive : null,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.chipsContainer}
        />
      </View>

      {/* Pro Registration Banner */}
      <View style={styles.proBanner}>
        <View style={styles.proBannerTextContainer}>
          <Text style={styles.proBannerTitle}>Are you a builder or architect?</Text>
          <Text style={styles.proBannerSubtitle}>Register your details to reach regional clients</Text>
        </View>
        <TouchableOpacity
          style={styles.proBannerBtn}
          onPress={() => navigation.navigate("ProRegistration")}
        >
          <Text style={styles.proBannerBtnTxt}>{user ? "Manage" : "Join Now"}</Text>
          <Ionicons name="arrow-forward" size={14} color="#1E293B" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      {/* Directory Listings */}
      <FlatList
        data={pros}
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
              <Ionicons name="people-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyText}>No professionals match your filters.</Text>
            </View>
          ) : null
        }
      />

      {/* Custom Styled Alert Modal */}
      <Modal
        visible={alertModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAlertModal(prev => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderIcon}>
              <Ionicons 
                name={alertModal.title.toLowerCase().includes("error") ? "alert-circle" : "information-circle"} 
                size={36} 
                color={alertModal.title.toLowerCase().includes("error") ? "#EF4444" : "#D9A443"} 
              />
            </View>
            <Text style={styles.modalTitle}>{alertModal.title}</Text>
            <Text style={styles.modalLabel}>{alertModal.message}</Text>
            <View style={styles.modalBtnRow}>
              {alertModal.buttons.map((btn, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.modalBtn, 
                    btn.isPrimary ? styles.modalBtnSave : styles.modalBtnCancel
                  ]}
                  onPress={btn.onPress || (() => setAlertModal(prev => ({ ...prev, visible: false })))}
                >
                  <Text style={[
                    styles.modalBtnText, 
                    !btn.isPrimary && styles.modalBtnTextCancel
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  searchSection: {
    backgroundColor: "#1E293B",
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  input: {
    flex: 1,
    color: "#1E293B",
    fontSize: 14,
    height: "100%",
  },
  btnSearch: {
    backgroundColor: "#D9A443",
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  chipsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  categoryChip: {
    backgroundColor: "#334155",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: "#D9A443",
  },
  categoryChipText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  categoryChipTextActive: {
    color: "#1E293B",
    fontWeight: "bold",
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarTxt: {
    color: "#D9A443",
    fontSize: 18,
    fontWeight: "bold",
  },
  mainInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
  },
  category: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  cardBody: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 12,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  detailIcon: {
    marginRight: 8,
    width: 16,
  },
  detailText: {
    fontSize: 13,
    color: "#475569",
  },
  descText: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
    marginTop: 6,
    fontStyle: "italic",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  btnAction: {
    flex: 1,
    flexDirection: "row",
    height: 38,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  btnCall: {
    backgroundColor: "#F1F5F9",
    marginRight: 8,
  },
  btnTextCall: {
    color: "#1E293B",
    fontSize: 13,
    fontWeight: "bold",
  },
  btnChat: {
    backgroundColor: "#25D366",
    marginLeft: 8,
  },
  btnTextChat: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
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
  proBanner: {
    backgroundColor: "#F1F5F9",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  proBannerTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  proBannerTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1E293B",
  },
  proBannerSubtitle: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
  },
  proBannerBtn: {
    backgroundColor: "#D9A443",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  proBannerBtnTxt: {
    color: "#1E293B",
    fontSize: 11,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: "100%",
    maxWidth: 340,
    padding: 20,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeaderIcon: {
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 10,
    textAlign: "center",
  },
  modalLabel: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 20,
    lineHeight: 18,
    textAlign: "center",
  },
  modalBtnRow: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
  },
  modalBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    marginHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnCancel: {
    backgroundColor: "#F1F5F9",
  },
  modalBtnSave: {
    backgroundColor: "#D9A443",
  },
  modalBtnText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  modalBtnTextCancel: {
    color: "#475569",
  },
});

export default DirectoryScreen;
