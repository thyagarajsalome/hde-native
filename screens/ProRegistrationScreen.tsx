import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../services/supabaseClient";
import { useUser } from "../context/UserContext";

const CATEGORIES = [
  "House Contractor",
  "Architect",
  "Structural Engineer",
  "3D Designer / Visualizer",
  "Interior Designer",
  "Electrician",
  "Plumber",
  "Painter",
  "Carpenter",
  "Draftsman",
  "Material Vendor",
  "Borewell Contractor",
  "Fabricator (Grill/Gate)",
  "Waterproofing Specialist",
  "Solar / UPS Vendor",
  "Floor Layman",
  "Windows & Door Contractor"
].sort();

const INDIAN_CITIES = [
  "Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Pune", 
  "Ahmedabad", "Surat", "Jaipur", "Lucknow", "Nagpur", "Indore", "Bhopal", 
  "Visakhapatnam", "Patna", "Vadodara", "Coimbatore", "Kochi", "Gurgaon", "Noida"
].sort();

export const ProRegistrationScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, loading: authLoading } = useUser();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [isExisting, setIsExisting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    category: "House Contractor",
    years_of_experience: 0,
    city: "",
    area: "",
    contact_number: "",
    whatsapp_number: "",
    bio: "",
  });

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setFetching(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("professionals")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setFormData({
            name: data.name || "",
            email: data.email || "",
            category: data.category || "House Contractor",
            years_of_experience: data.years_of_experience || 0,
            city: data.city || "",
            area: data.area || "",
            contact_number: data.contact_number || "",
            whatsapp_number: data.whatsapp_number || "",
            bio: data.bio || "",
          });
          setIsExisting(true);
          setAgreed(true);
        }
      } catch (err) {
        console.error("Error loading professional profile:", err);
      } finally {
        setFetching(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert("Session Expired", "Please log in again.");
      return;
    }
    if (!formData.name || !formData.city || !formData.contact_number) {
      Alert.alert("Missing Fields", "Please fill in all required fields (*).");
      return;
    }
    if (!agreed) {
      Alert.alert("Agreement Required", "Please agree to the disclaimer terms to submit your profile.");
      return;
    }

    setLoading(true);
    try {
      const payload = { ...formData, user_id: user.id };
      
      const { error } = isExisting
        ? await supabase.from("professionals").update(payload).eq("user_id", user.id)
        : await supabase.from("professionals").insert(payload);

      if (error) throw error;

      Alert.alert(
        "Success",
        isExisting ? "Your professional profile has been updated!" : "Your listing has been submitted for verification!",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
      setIsExisting(true);
    } catch (err: any) {
      console.error("Pro submission error:", err);
      Alert.alert("Submission Failed", err.message || "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "Delete Listing",
      "Are you sure you want to permanently delete your professional directory listing?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Profile",
          style: "destructive",
          onPress: async () => {
            if (!user) return;
            setLoading(true);
            try {
              const { error } = await supabase.from("professionals").delete().eq("user_id", user.id);
              if (error) throw error;
              Alert.alert("Deleted", "Your listing was removed successfully.", [
                { text: "OK", onPress: () => navigation.goBack() },
              ]);
            } catch (err: any) {
              console.error("Delete pro error:", err);
              Alert.alert("Error", "Failed to delete listing.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (authLoading || fetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D9A443" />
        <Text style={styles.loadingText}>Loading profile details...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="lock-closed-outline" size={48} color="#64748B" style={{ marginBottom: 16 }} />
        <Text style={styles.warningText}>Sign In required to register in our directory.</Text>
        <TouchableOpacity style={styles.btnSignIn} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.btnSignInText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}>
        {isExisting && (
          <View style={styles.deleteCard}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.deleteTitle}>Remove Directory Listing</Text>
              <Text style={styles.deleteDesc}>Delete your professional record from our database.</Text>
            </View>
            <TouchableOpacity style={styles.btnDelete} onPress={handleDelete} disabled={loading}>
              <Text style={styles.btnDeleteText}>Delete Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>Business Details</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Full Name / Company Name *</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="e.g. John Builders"
              value={formData.name}
              onChangeText={(val) => setFormData({ ...formData, name: val })}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Business Email (Optional)</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="e.g. john@builders.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={(val) => setFormData({ ...formData, email: val })}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Years of Experience</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="e.g. 5"
              keyboardType="numeric"
              value={String(formData.years_of_experience)}
              onChangeText={(val) => setFormData({ ...formData, years_of_experience: parseInt(val, 10) || 0 })}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Category & Location</Text>

        {/* Category Picker Selector */}
        <Text style={styles.label}>Professional Category *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, formData.category === c ? styles.chipActive : null]}
              onPress={() => setFormData({ ...formData, category: c })}
            >
              <Text style={[styles.chipText, formData.category === c ? styles.chipTextActive : null]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Serving City *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
          {INDIAN_CITIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, formData.city === c ? styles.chipActive : null]}
              onPress={() => setFormData({ ...formData, city: c })}
            >
              <Text style={[styles.chipText, formData.city === c ? styles.chipTextActive : null]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Area / Locality (e.g. Whitefield)</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Whitefield"
              value={formData.area}
              onChangeText={(val) => setFormData({ ...formData, area: val })}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Contact Details</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Primary Contact Number *</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="10 digit phone number"
              keyboardType="phone-pad"
              value={formData.contact_number}
              onChangeText={(val) => setFormData({ ...formData, contact_number: val })}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>WhatsApp Number (Optional)</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Include country code"
              keyboardType="phone-pad"
              value={formData.whatsapp_number}
              onChangeText={(val) => setFormData({ ...formData, whatsapp_number: val })}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Professional Bio & Services</Text>
          <View style={[styles.inputWrapper, { height: 100, paddingVertical: 8 }]}>
            <TextInput
              style={[styles.input, { textAlignVertical: "top" }]}
              placeholder="Describe your specializations, materials used, rates, etc."
              multiline={true}
              numberOfLines={4}
              maxLength={300}
              value={formData.bio}
              onChangeText={(val) => setFormData({ ...formData, bio: val })}
            />
          </View>
        </View>

        {/* Disclaimer Check */}
        <TouchableOpacity
          style={styles.disclaimerRow}
          onPress={() => setAgreed(!agreed)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={agreed ? "checkbox" : "square-outline"}
            size={22}
            color={agreed ? "#D9A443" : "#64748B"}
            style={{ marginRight: 12 }}
          />
          <Text style={styles.disclaimerText}>
            I agree that HDE is strictly a matching portal. I understand I am registering as an independent builder/architect and am not legally partnered with HDE.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnSubmit, !agreed ? styles.btnSubmitDisabled : null]}
          onPress={handleSubmit}
          disabled={!agreed || loading}
        >
          {loading ? (
            <ActivityIndicator color="#1E293B" />
          ) : (
            <Text style={styles.btnSubmitText}>
              {isExisting ? "Update Directory Profile" : "Register Profile Listing"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
  },
  warningText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
  },
  btnSignIn: {
    backgroundColor: "#1E293B",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  btnSignInText: {
    color: "#D9A443",
    fontWeight: "bold",
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
  },
  deleteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderColor: "#FEE2E2",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  deleteTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#991B1B",
  },
  deleteDesc: {
    fontSize: 10,
    color: "#EF4444",
    marginTop: 2,
  },
  btnDelete: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  btnDeleteText: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 10,
  },
  inputContainer: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    height: 44,
    justifyContent: "center",
  },
  input: {
    color: "#1E293B",
    fontSize: 14,
  },
  chipsContainer: {
    paddingBottom: 14,
  },
  chip: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: "#D9A443",
  },
  chipText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#1E293B",
    fontWeight: "bold",
  },
  disclaimerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: "#475569",
    lineHeight: 16,
  },
  btnSubmit: {
    backgroundColor: "#D9A443",
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#D9A443",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 24,
  },
  btnSubmitDisabled: {
    backgroundColor: "#CBD5E1",
    shadowOpacity: 0,
    elevation: 0,
  },
  btnSubmitText: {
    color: "#1E293B",
    fontSize: 15,
    fontWeight: "bold",
  },
});

export default ProRegistrationScreen;
