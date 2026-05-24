import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../services/supabaseClient";
import { useUser } from "../context/UserContext";

const FACING_OPTIONS = ["East", "West", "North", "South"];

export const PlanUploaderScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { role } = useUser();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form states
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [facing, setFacing] = useState("East");
  const [dimensions, setDimensions] = useState(""); // e.g., 30x40
  const [floors, setFloors] = useState("G+1");
  const [bedrooms, setBedrooms] = useState("2");
  const [bathrooms, setBathrooms] = useState("2");
  const [parking, setParking] = useState("1 Car");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);

  // Guard against non-admin access
  if (role !== "admin") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="shield-outline" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorSubtitle}>
            Only administrators are authorized to access the Plan Uploader portal.
          </Text>
          <TouchableOpacity style={styles.btnBack} onPress={() => navigation.goBack()}>
            <Text style={styles.btnBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Permission to access the photo gallery is required to upload a plan layout."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (err: any) {
      console.error("Error picking image:", err);
      Alert.alert("Error", "Failed to select image from library.");
    }
  };

  const handleUpload = async () => {
    if (!imageUri || !title || !area) {
      Alert.alert("Missing Fields", "Please fill in all required fields (*) and select a plan image.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      // 1. Fetch file uri and convert to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // 2. Compute upload path
      const timestamp = Date.now();
      const fileExt = imageUri.split(".").pop() || "jpg";
      const fullPath = `full-plans/${timestamp}-plan.${fileExt}`;

      setUploadProgress(40);

      // 3. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("house-plans")
        .upload(fullPath, blob, {
          contentType: `image/${fileExt === "png" ? "png" : "jpeg"}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;
      setUploadProgress(75);

      // 4. Save metadata record to DB
      const { error: dbError } = await supabase.from("house_plans").insert({
        title,
        area_sqft: parseInt(area, 10) || 0,
        facing,
        dimensions,
        floors,
        bedrooms: parseInt(bedrooms, 10) || 0,
        bathrooms: parseInt(bathrooms, 10) || 0,
        parking,
        description,
        file_url: fullPath, // Store relative path in DB matching web app logic
        youtube_url: youtubeUrl || null,
      });

      if (dbError) throw dbError;

      setUploadProgress(100);
      Alert.alert("Success", "House plan uploaded successfully to Plan Gallery!", [
        {
          text: "OK",
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (err: any) {
      console.error("Upload error:", err);
      Alert.alert("Upload Failed", err.message || "An error occurred during submission.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-upload" size={24} color="#1E293B" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Upload New House Plan</Text>
            <Text style={styles.headerSubtitle}>Add layout sheets and specific design metadata</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Basic Specs</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Plan Title *</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="e.g. 30x40 East Facing G+1"
                placeholderTextColor="#94A3B8"
                value={title}
                onChangeText={setTitle}
                editable={!isUploading}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Area (sq.ft) *</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 1200"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={area}
                  onChangeText={setArea}
                  editable={!isUploading}
                />
              </View>
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Dimensions (e.g. 30x40)</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="30x40"
                  placeholderTextColor="#94A3B8"
                  value={dimensions}
                  onChangeText={setDimensions}
                  editable={!isUploading}
                />
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Configuration & Layout</Text>

          <Text style={styles.label}>Facing Direction *</Text>
          <View style={styles.facingContainer}>
            {FACING_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.facingChip, facing === opt ? styles.facingChipActive : null]}
                onPress={() => setFacing(opt)}
                disabled={isUploading}
              >
                <Text style={[styles.facingText, facing === opt ? styles.facingTextActive : null]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 6 }]}>
              <Text style={styles.label}>Floors</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="G+1"
                  placeholderTextColor="#94A3B8"
                  value={floors}
                  onChangeText={setFloors}
                  editable={!isUploading}
                />
              </View>
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginHorizontal: 6 }]}>
              <Text style={styles.label}>Bedrooms</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="2"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={bedrooms}
                  onChangeText={setBedrooms}
                  editable={!isUploading}
                />
              </View>
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 6 }]}>
              <Text style={styles.label}>Bathrooms</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="2"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={bathrooms}
                  onChangeText={setBathrooms}
                  editable={!isUploading}
                />
              </View>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Parking Details</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="e.g. 1 Car or 2 Bikes"
                placeholderTextColor="#94A3B8"
                value={parking}
                onChangeText={setParking}
                editable={!isUploading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>YouTube Walkthrough URL</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="https://youtube.com/shorts/..."
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                keyboardType="url"
                value={youtubeUrl}
                onChangeText={setYoutubeUrl}
                editable={!isUploading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Detailed Description & Specifications</Text>
            <View style={[styles.inputWrapper, { height: 100, paddingVertical: 8 }]}>
              <TextInput
                style={[styles.input, { textAlignVertical: "top" }]}
                placeholder="Describe layout details (kitchen info, living hall size, materials, etc.)"
                placeholderTextColor="#94A3B8"
                multiline={true}
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
                editable={!isUploading}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Plan Layout Image</Text>

          <TouchableOpacity
            style={styles.imageSelector}
            onPress={handlePickImage}
            disabled={isUploading}
          >
            {imageUri ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: imageUri }} style={styles.selectedImage} resizeMode="contain" />
                <View style={styles.changeOverlay}>
                  <Ionicons name="camera" size={20} color="#FFFFFF" />
                  <Text style={styles.changeText}>Change Image</Text>
                </View>
              </View>
            ) : (
              <View style={styles.placeholderContainer}>
                <Ionicons name="image-outline" size={44} color="#94A3B8" />
                <Text style={styles.selectorTitle}>Select High-Res Plan Image *</Text>
                <Text style={styles.selectorSubtitle}>PNG or JPG formats accepted</Text>
              </View>
            )}
          </TouchableOpacity>

          {isUploading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressText}>Uploading Plan Layout...</Text>
                <Text style={styles.progressPercent}>{uploadProgress}%</Text>
              </View>
              <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btnSubmit, isUploading ? styles.btnSubmitDisabled : null]}
            onPress={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#1E293B" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color="#1E293B" style={{ marginRight: 8 }} />
                <Text style={styles.btnSubmitText}>Upload House Plan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#D9A443",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 16,
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
    flex: 1,
  },
  row: {
    flexDirection: "row",
  },
  facingContainer: {
    flexDirection: "row",
    marginBottom: 14,
  },
  facingChip: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  facingChipActive: {
    backgroundColor: "#D9A443",
    borderColor: "#D9A443",
  },
  facingText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  facingTextActive: {
    color: "#1E293B",
    fontWeight: "bold",
  },
  imageSelector: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    borderRadius: 16,
    height: 180,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 20,
  },
  placeholderContainer: {
    alignItems: "center",
    padding: 16,
  },
  selectorTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#475569",
    marginTop: 10,
  },
  selectorSubtitle: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
  imageContainer: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  selectedImage: {
    width: "100%",
    height: "100%",
  },
  changeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  changeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  progressPercent: {
    fontSize: 12,
    color: "#D9A443",
    fontWeight: "bold",
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#D9A443",
  },
  btnSubmit: {
    backgroundColor: "#D9A443",
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#D9A443",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    marginTop: 60,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#EF4444",
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  btnBack: {
    backgroundColor: "#1E293B",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  btnBackText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
});

export default PlanUploaderScreen;
