import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../context/UserContext";
import { supabase } from "../services/supabaseClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import Slider from "@react-native-community/slider";

// ── Constants ──────────────────────────────────────────────────────────────────
const PARKING_RATE_FACTOR = 0.7;
const COMPOUND_WALL_RATE  = 800;
const SUMP_TANK_COST      = { basic: 150000, standard: 200000, premium: 250000 };
const QUALITY_RATES       = { basic: 1600, standard: 2100, premium: 2900 };

const QUALITY_INFO = {
  basic: {
    label: "Basic",
    features: ["OPC cement, Fe415 steel", "Red brick masonry", "Basic vitrified tiles", "Distemper paint"],
  },
  standard: {
    label: "Standard",
    features: ["OPC 53 cement, Fe500D steel", "Fly ash brick masonry", "GVT tiles 600x600", "Premium emulsion"],
  },
  premium: {
    label: "Premium",
    features: ["TATA Tiscon Fe500D steel", "AAC block masonry", "Marble/granite tiles", "Royale luxury paint"],
  },
};

const BREAKDOWN_PERCENTAGES: Record<string, number> = {
  Foundation: 12, Structure: 30, Masonry: 12, Roofing: 10,
  Finishing: 20, "Elec/Plumbing": 10, Miscellaneous: 6,
};

interface FormStepProps {
  area: string;
  setArea: (val: string) => void;
  parkingArea: string;
  setParkingArea: (val: string) => void;
  compoundWallLength: string;
  setCompoundWallLength: (val: string) => void;
  includeSump: boolean;
  setIncludeSump: (val: boolean) => void;
  quality: "basic" | "standard" | "premium";
  setQuality: (val: "basic" | "standard" | "premium") => void;
  isEditingRate: boolean;
  setIsEditingRate: (val: boolean) => void;
  customRate: number;
  setCustomRate: (val: number) => void;
  parsedArea: number;
  setWizardStep: (step: number) => void;
}

const FormStep = React.memo(({
  area,
  setArea,
  parkingArea,
  setParkingArea,
  compoundWallLength,
  setCompoundWallLength,
  includeSump,
  setIncludeSump,
  quality,
  setQuality,
  isEditingRate,
  setIsEditingRate,
  customRate,
  setCustomRate,
  parsedArea,
  setWizardStep,
}: FormStepProps) => {
  return (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>1. Project Dimension Inputs</Text>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Built-up Area (Sq.Ft)*</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="resize" size={18} color="#64748B" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="e.g. 1500"
            keyboardType="numeric"
            value={area}
            onChangeText={setArea}
          />
        </View>
        <View style={styles.sliderRow}>
          <Slider
            style={styles.slider}
            minimumValue={500}
            maximumValue={5000}
            step={50}
            value={parseFloat(area) || 500}
            onValueChange={(val) => setArea(String(val))}
            minimumTrackTintColor="#D9A443"
            maximumTrackTintColor="#CBD5E1"
            thumbTintColor="#D9A443"
          />
          <Text style={styles.sliderValueText}>{parseFloat(area) || 500} sqft</Text>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Parking Area (Sq.Ft)</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="car" size={18} color="#64748B" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="e.g. 200"
            keyboardType="numeric"
            value={parkingArea}
            onChangeText={setParkingArea}
          />
        </View>
        <View style={styles.sliderRow}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1000}
            step={10}
            value={parseFloat(parkingArea) || 0}
            onValueChange={(val) => setParkingArea(String(val))}
            minimumTrackTintColor="#D9A443"
            maximumTrackTintColor="#CBD5E1"
            thumbTintColor="#D9A443"
          />
          <Text style={styles.sliderValueText}>{parseFloat(parkingArea) || 0} sqft</Text>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Compound Wall Length (Running Feet)</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="git-commit" size={18} color="#64748B" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="e.g. 120"
            keyboardType="numeric"
            value={compoundWallLength}
            onChangeText={setCompoundWallLength}
          />
        </View>
        <View style={styles.sliderRow}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={500}
            step={10}
            value={parseFloat(compoundWallLength) || 0}
            onValueChange={(val) => setCompoundWallLength(String(val))}
            minimumTrackTintColor="#D9A443"
            maximumTrackTintColor="#CBD5E1"
            thumbTintColor="#D9A443"
          />
          <Text style={styles.sliderValueText}>{parseFloat(compoundWallLength) || 0} ft</Text>
        </View>
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.switchLabel}>Include Under-ground Sump Tank</Text>
          <Text style={styles.switchDesc}>Estimated capacity rates based on quality tier.</Text>
        </View>
        <Switch value={includeSump} onValueChange={setIncludeSump} trackColor={{ true: "#D9A443" }} />
      </View>

      <Text style={styles.sectionTitle}>2. Material & Finishing Quality</Text>
      <View style={styles.qualityRow}>
        {(["basic", "standard", "premium"] as const).map((q) => (
          <TouchableOpacity
            key={q}
            style={[
              styles.qualityBtn,
              quality === q ? styles.qualityBtnActive : null,
            ]}
            onPress={() => setQuality(q)}
          >
            <Text style={[styles.qualityBtnText, quality === q ? styles.qualityBtnTextActive : null]}>
              {QUALITY_INFO[q].label}
            </Text>
            <Text style={[styles.qualityPrice, quality === q ? styles.qualityPriceActive : null]}>
              ₹{QUALITY_RATES[q]}/sqft
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom Rate Panel */}
      <View style={styles.ratePanel}>
        <View style={styles.rateHeader}>
          <Text style={styles.rateLabel}>Estimated Base Rate per Sqft:</Text>
          <TouchableOpacity onPress={() => setIsEditingRate(!isEditingRate)}>
            <Text style={styles.editRateBtn}>{isEditingRate ? "Reset" : "Edit Rate"}</Text>
          </TouchableOpacity>
        </View>
        {isEditingRate ? (
          <View style={styles.inputWrapperSmall}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={String(customRate)}
              onChangeText={(val) => setCustomRate(parseInt(val, 10) || 0)}
            />
          </View>
        ) : (
          <Text style={styles.rateValue}>₹{customRate} / sq.ft</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.btnPrimary}
        onPress={() => {
          if (!area || parsedArea <= 0) {
            Alert.alert("Missing Input", "Please enter a valid Built-up Area");
            return;
          }
          setWizardStep(2);
        }}
      >
        <Text style={styles.btnText}>Calculate Construction Cost</Text>
        <Ionicons name="arrow-forward" size={18} color="#1E293B" style={styles.iconMarginLeft6} />
      </TouchableOpacity>
    </View>
  );
});

interface ResultsStepProps {
  finalTotalCost: number;
  perSqftCost: number;
  isSaving: boolean;
  isExporting: boolean;
  activeResultsTab: "breakdown" | "savings";
  setActiveResultsTab: (tab: "breakdown" | "savings") => void;
  selectedSavings: string[];
  toggleSavingOption: (option: string) => void;
  breakdownData: Record<string, number>;
  parsedArea: number;
  quality: "basic" | "standard" | "premium";
  includeSump: boolean;
  handleSave: () => void;
  handleExportPDF: () => void;
  setWizardStep: (step: number) => void;
}

const ResultsStep = React.memo(({
  finalTotalCost,
  perSqftCost,
  isSaving,
  isExporting,
  activeResultsTab,
  setActiveResultsTab,
  selectedSavings,
  toggleSavingOption,
  breakdownData,
  parsedArea,
  quality,
  includeSump,
  handleSave,
  handleExportPDF,
  setWizardStep,
}: ResultsStepProps) => {
  const formattedTotal = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(finalTotalCost);
  const formattedPerSqft = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(perSqftCost);

  return (
    <View style={styles.resultsContainer}>
      {/* KPI Strip */}
      <View style={styles.kpiCard}>
        <Text style={styles.kpiTitle}>Total Estimated Budget</Text>
        <Text style={styles.kpiValue}>{formattedTotal}</Text>
        <Text style={styles.kpiSub}>Average Rate: {formattedPerSqft} / sq.ft</Text>
      </View>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.btnAction} onPress={handleSave} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator color="#64748B" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#475569" />
              <Text style={styles.btnActionText}>Save Project</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnAction} onPress={handleExportPDF} disabled={isExporting}>
          {isExporting ? (
            <ActivityIndicator color="#64748B" />
          ) : (
            <>
              <Ionicons name="share-outline" size={18} color="#475569" />
              <Text style={styles.btnActionText}>Export PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Tab Controls */}
      <View style={styles.resultsTabs}>
        <TouchableOpacity
          style={[styles.resultsTabBtn, activeResultsTab === "breakdown" ? styles.resultsTabBtnActive : null]}
          onPress={() => setActiveResultsTab("breakdown")}
        >
          <Text style={[styles.resultsTabBtnText, activeResultsTab === "breakdown" ? styles.resultsTabBtnTextActive : null]}>
            Phase Breakdown
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.resultsTabBtn, activeResultsTab === "savings" ? styles.resultsTabBtnActive : null]}
          onPress={() => setActiveResultsTab("savings")}
        >
          <Text style={[styles.resultsTabBtnText, activeResultsTab === "savings" ? styles.resultsTabBtnTextActive : null]}>
            Savings Advisor
          </Text>
        </TouchableOpacity>
      </View>

      {activeResultsTab === "breakdown" ? (
        <View style={styles.breakdownBox}>
          <Text style={styles.boxTitle}>Estimated Cost Splits by Phase</Text>
          {Object.entries(breakdownData).map(([phase, cost]) => (
            <View key={phase} style={styles.breakdownRow}>
              <Text style={styles.breakdownPhase}>{phase}</Text>
              <Text style={styles.breakdownCost}>
                {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(cost)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.savingsBox}>
          <Text style={styles.boxTitle}>Optimize Construction Costs</Text>
           <TouchableOpacity
            style={[styles.savingsOption, selectedSavings.includes("flyash") ? styles.savingsOptionActive : null]}
            onPress={() => toggleSavingOption("flyash")}
          >
            <Ionicons
              name={selectedSavings.includes("flyash") ? "checkbox" : "square-outline"}
              size={22}
              color={selectedSavings.includes("flyash") ? "#D9A443" : "#64748B"}
              style={styles.iconMarginRight12}
            />
            <View style={styles.flexOne}>
              <Text style={styles.savingsOptionTitle}>Use Fly-Ash Bricks</Text>
              <Text style={styles.savingsOptionDesc}>Saves ~₹50 per sqft. Lower plaster requirement.</Text>
            </View>
            <Text style={styles.savingsOptionValue}>-₹{(parsedArea * 50).toLocaleString("en-IN")}</Text>
          </TouchableOpacity>
 
          {quality === "premium" && (
            <TouchableOpacity
              style={[styles.savingsOption, selectedSavings.includes("tiles") ? styles.savingsOptionActive : null]}
              onPress={() => toggleSavingOption("tiles")}
            >
              <Ionicons
                name={selectedSavings.includes("tiles") ? "checkbox" : "square-outline"}
                size={22}
                color={selectedSavings.includes("tiles") ? "#D9A443" : "#64748B"}
                style={styles.iconMarginRight12}
              />
              <View style={styles.flexOne}>
                <Text style={styles.savingsOptionTitle}>Standard GVT Tiles vs Import</Text>
                <Text style={styles.savingsOptionDesc}>Saves ~₹120 per sqft. Premium locally-made alternative.</Text>
              </View>
              <Text style={styles.savingsOptionValue}>-₹{(parsedArea * 120).toLocaleString("en-IN")}</Text>
            </TouchableOpacity>
          )}
 
          {includeSump && (
            <TouchableOpacity
              style={[styles.savingsOption, selectedSavings.includes("sump_tank") ? styles.savingsOptionActive : null]}
              onPress={() => toggleSavingOption("sump_tank")}
            >
              <Ionicons
                name={selectedSavings.includes("sump_tank") ? "checkbox" : "square-outline"}
                size={22}
                color={selectedSavings.includes("sump_tank") ? "#D9A443" : "#64748B"}
                style={styles.iconMarginRight12}
              />
              <View style={styles.flexOne}>
                <Text style={styles.savingsOptionTitle}>Prefabricated Sump Tank</Text>
                <Text style={styles.savingsOptionDesc}>Saves ~₹50,000. Fast installation, less brick masonry.</Text>
              </View>
              <Text style={styles.savingsOptionValue}>-₹50,000</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
 
      <TouchableOpacity
        style={styles.btnSecondary}
        onPress={() => setWizardStep(1)}
      >
        <Ionicons name="arrow-back" size={18} color="#475569" style={styles.iconMarginRight6} />
        <Text style={styles.btnSecondaryText}>Modify Inputs</Text>
      </TouchableOpacity>
    </View>
  );
});

export const ConstructionCalculatorScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { hasPaid, markup = 0, user, refreshProfile, planTier, credits, role } = useUser();
  const insets = useSafeAreaInsets();
  const editProject = route.params?.projectData;
  const editName = route.params?.projectName;
  const projectId = route.params?.projectId;

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Form states
  const [area, setArea] = useState("");
  const [parkingArea, setParkingArea] = useState("");
  const [compoundWallLength, setCompoundWallLength] = useState("");
  const [includeSump, setIncludeSump] = useState(false);
  const [quality, setQuality] = useState<"basic" | "standard" | "premium">("basic");
  const [customRate, setCustomRate] = useState<number>(QUALITY_RATES.basic);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [selectedSavings, setSelectedSavings] = useState<string[]>([]);
  const [activeResultsTab, setActiveResultsTab] = useState<"breakdown" | "savings">("breakdown");

  // Load project or retrieve draft
  useEffect(() => {
    const loadData = async () => {
      if (editProject) {
        if (editProject.area) setArea(String(editProject.area));
        if (editProject.parkingArea) setParkingArea(String(editProject.parkingArea));
        if (editProject.compoundWallLength) setCompoundWallLength(String(editProject.compoundWallLength));
        if (editProject.includeSump !== undefined) setIncludeSump(Boolean(editProject.includeSump));
        if (editProject.quality) setQuality(editProject.quality);
        if (editProject.rate) {
          setCustomRate(editProject.rate);
          setIsEditingRate(editProject.rate !== QUALITY_RATES[editProject.quality as keyof typeof QUALITY_RATES]);
        }
        if (editProject.selectedSavings) setSelectedSavings(editProject.selectedSavings);
        setWizardStep(2); // Go directly to calculation result
      } else if (user) {
        try {
          const draftKey = `hde_draft_${user.id}_construction`;
          const savedDraft = await AsyncStorage.getItem(draftKey);
          if (savedDraft) {
            const d = JSON.parse(savedDraft);
            if (d.area) setArea(String(d.area));
            if (d.parkingArea) setParkingArea(String(d.parkingArea));
            if (d.compoundWallLength) setCompoundWallLength(String(d.compoundWallLength));
            if (d.includeSump !== undefined) setIncludeSump(Boolean(d.includeSump));
            if (d.quality) setQuality(d.quality);
            if (d.rate) {
              setCustomRate(d.rate);
              setIsEditingRate(d.rate !== QUALITY_RATES[d.quality as keyof typeof QUALITY_RATES]);
            }
          }
        } catch (err) {
          console.warn("Failed to load local draft:", err);
        }
      }
    };
    loadData();
  }, [editProject, user]);

  // Sync rate with quality selections
  useEffect(() => {
    if (!isEditingRate) {
      setCustomRate(QUALITY_RATES[quality]);
    }
  }, [quality, isEditingRate]);

  // Debounced draft autosave
  useEffect(() => {
    if (editProject || !user) return;
    if (area || parkingArea || compoundWallLength) {
      const delay = setTimeout(async () => {
        try {
          const draftKey = `hde_draft_${user.id}_construction`;
          const draftData = { area, parkingArea, compoundWallLength, includeSump, quality, rate: customRate };
          await AsyncStorage.setItem(draftKey, JSON.stringify(draftData));
        } catch (err) {
          console.warn("Failed to autosave draft:", err);
        }
      }, 1500);
      return () => clearTimeout(delay);
    }
  }, [area, parkingArea, compoundWallLength, includeSump, quality, customRate]);

  // Calculations
  const parsedArea = parseFloat(area) || 0;
  const parsedParking = parseFloat(parkingArea) || 0;
  const parsedWall = parseFloat(compoundWallLength) || 0;

  const mFactor = hasPaid ? (1 + markup / 100) : 1;

  const costs = useMemo(() => ({
    main: (parsedArea * customRate) * mFactor,
    parking: (parsedParking * (customRate * PARKING_RATE_FACTOR)) * mFactor,
    wall: (parsedWall * COMPOUND_WALL_RATE) * mFactor,
    sump: (includeSump ? SUMP_TANK_COST[quality] : 0) * mFactor,
  }), [parsedArea, parsedParking, parsedWall, customRate, includeSump, quality, mFactor]);

  const totalCost = costs.main + costs.parking + costs.wall + costs.sump;

  const savings = useMemo(() => {
    let tilesSaving = 0;
    let flyashSaving = 0;
    let sumpSaving = 0;

    if (quality === "premium" && selectedSavings.includes("tiles")) {
      tilesSaving = parsedArea * 120 * mFactor;
    }
    if ((quality === "premium" || quality === "standard") && selectedSavings.includes("flyash")) {
      flyashSaving = parsedArea * 50 * mFactor;
    }
    if (includeSump && selectedSavings.includes("sump_tank")) {
      sumpSaving = 50000 * mFactor;
    }

    return {
      tiles: tilesSaving,
      flyash: flyashSaving,
      sump: sumpSaving,
      total: tilesSaving + flyashSaving + sumpSaving,
    };
  }, [quality, selectedSavings, parsedArea, includeSump, mFactor]);

  const finalTotalCost = Math.max(0, totalCost - savings.total);
  const perSqftCost = parsedArea > 0 ? Math.round(finalTotalCost / parsedArea) : 0;

  const breakdownData = useMemo(() => {
    const structuralBase = costs.main;
    return Object.fromEntries(
      Object.entries(BREAKDOWN_PERCENTAGES).map(([k, pct]) => {
        let phaseCost = (structuralBase * pct) / 100;
        if (k === "Masonry" && selectedSavings.includes("flyash")) {
          phaseCost = Math.max(0, phaseCost - savings.flyash);
        }
        if (k === "Finishing" && selectedSavings.includes("tiles")) {
          phaseCost = Math.max(0, phaseCost - savings.tiles);
        }
        return [k, phaseCost];
      })
    );
  }, [costs.main, selectedSavings, savings]);

  const toggleSavingOption = useCallback((option: string) => {
    setSelectedSavings((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to save this project.", [
        { text: "Cancel" },
        { text: "Sign In", onPress: () => navigation.navigate("Login") },
      ]);
      return;
    }

    if (!projectId && planTier !== "pro" && credits <= 0) {
      Alert.alert("Upgrade Required", "You have 0 credits remaining. Please upgrade your plan.", [
        { text: "Cancel" },
        { text: "Upgrade", onPress: () => navigation.navigate("Upgrade") },
      ]);
      return;
    }

    Alert.prompt(
      "Save Project",
      "Enter a name for this estimation draft:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: async (name?: string) => {
            if (!name || !name.trim()) {
              Alert.alert("Invalid Name", "Project name cannot be empty.");
              return;
            }
            setIsSaving(true);
            try {
              const projectData = {
                area: parsedArea,
                parkingArea: parsedParking,
                compoundWallLength: parsedWall,
                includeSump,
                quality,
                rate: customRate,
                totalCost: finalTotalCost,
                breakdown: breakdownData,
                savings: savings.total,
                savingsList: selectedSavings,
              };

              const payload = {
                user_id: user.id,
                name: name.trim(),
                type: "construction",
                data: {
                  ...projectData,
                  perSqftCost,
                },
                date: new Date().toISOString(),
              };

              let saveError;
              if (projectId) {
                const { error } = await supabase
                  .from("projects")
                  .update({
                    name: name.trim(),
                    data: {
                      ...projectData,
                      perSqftCost,
                    },
                    date: new Date().toISOString(),
                  })
                  .eq("id", projectId);
                saveError = error;
              } else {
                const { error: rpcError } = await supabase.rpc("deduct_project_credit", {
                  user_uuid: user.id,
                });

                if (rpcError) {
                  if (rpcError.message.includes("limit") || rpcError.message.includes("credits")) {
                    Alert.alert("Upgrade Required", rpcError.message);
                    return;
                  }
                  throw rpcError;
                }

                const { error } = await supabase
                  .from("projects")
                  .insert(payload);
                saveError = error;
              }

              if (saveError) throw saveError;

              await refreshProfile();

              // Clear local draft
              const draftKey = `hde_draft_${user.id}_construction`;
              await AsyncStorage.removeItem(draftKey);

              Alert.alert("Success", "Project saved successfully!");
            } catch (err: any) {
              console.error("Save error:", err);
              Alert.alert("Save Failed", err.message || "Failed to save project.");
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
      "plain-text",
      editName || ""
    );
  }, [user, planTier, credits, parsedArea, parsedParking, parsedWall, includeSump, quality, customRate, finalTotalCost, perSqftCost, breakdownData, savings.total, selectedSavings, projectId, editName, navigation, refreshProfile]);

  const handleExportPDF = useCallback(async () => {
    if (!hasPaid && role !== "admin") {
      Alert.alert(
        "Upgrade Required",
        "Exporting PDF reports is a premium feature. Please upgrade to unlock.",
        [
          { text: "Cancel" },
          { text: "Upgrade", onPress: () => navigation.navigate("Upgrade") },
        ]
      );
      return;
    }

    setIsExporting(true);
    try {
      const formattedDate = new Date().toLocaleDateString("en-IN");
      const formattedTotal = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(finalTotalCost);

      const rowsHtml = Object.entries(breakdownData)
        .map(
          ([phase, cost]) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${phase} Estimate</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: bold; color: #1E293B;">
            ₹${Math.round(cost).toLocaleString("en-IN")}
          </td>
        </tr>
      `
        )
        .join("");

      const htmlContent = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 24px; color: #1E293B; background-color: #FFFFFF; }
              .report-header { border-bottom: 3px solid #D9A443; padding-bottom: 12px; margin-bottom: 20px; }
              .logo-title { font-size: 24px; font-weight: 800; color: #1E293B; letter-spacing: 0.5px; margin: 0; }
              .logo-title span { color: #D9A443; }
              .report-tag { font-size: 11px; color: #64748B; margin-top: 6px; font-weight: bold; text-transform: uppercase; }
              .table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
              .table th { background-color: #1E293B; color: #FFFFFF; text-align: left; padding: 10px 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
              .table td { padding: 10px 12px; border-bottom: 1px solid #E2E8F0; font-size: 11px; color: #334155; }
              .total-box { background-color: #FFFDF5; border: 1px solid #FCD34D; padding: 18px; border-radius: 8px; margin-top: 20px; margin-bottom: 30px; }
              .total-lbl { font-size: 11px; color: #78350F; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; }
              .total-val { font-size: 26px; font-weight: 800; color: #B45309; margin-top: 4px; }
              .sign-section { width: 100%; border-collapse: collapse; margin-top: 40px; }
              .sign-box { font-size: 11px; color: #64748B; vertical-align: top; }
              .sign-line { width: 180px; border-bottom: 1px solid #94A3B8; margin-top: 20px; height: 10px; }
              .footer { margin-top: 30px; font-size: 9px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 12px; line-height: 14px; }
            </style>
          </head>
          <body>
            <div class="report-header">
              <h1 class="logo-title">HOME DESIGN <span>ENGLISH</span></h1>
              <div class="report-tag">HOUSE CONSTRUCTION COST REPORT • Generated on ${formattedDate}</div>
            </div>

            <table style="width: 100%; margin-bottom: 20px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-collapse: collapse; border-radius: 8px;">
              <tr>
                <td style="padding: 12px 16px; border: 0; width: 50%; font-size: 12px; color: #475569; line-height: 1.6; vertical-align: top;">
                  <strong>Built-up Area:</strong> ${area} sq.ft<br/>
                  <strong>Parking Area:</strong> ${parkingArea || "0"} sq.ft<br/>
                  <strong>Compound Wall:</strong> ${compoundWallLength || "0"} ft
                </td>
                <td style="padding: 12px 16px; border: 0; width: 50%; font-size: 12px; color: #475569; line-height: 1.6; vertical-align: top;">
                  <strong>Sump Tank Included:</strong> ${includeSump ? "Yes" : "No"}<br/>
                  <strong>Material Quality:</strong> ${quality.toUpperCase()}<br/>
                  <strong>Base Estimation Rate:</strong> ₹${customRate}/sq.ft
                </td>
              </tr>
            </table>

            <table class="table">
              <thead>
                <tr>
                  <th>Phase Item</th>
                  <th style="text-align: right;">Estimated Cost</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">Main Superstructure (${area} sqft @ ₹${customRate}/sqft)</td>
                  <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right;">${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(costs.main)}</td>
                </tr>
                ${parsedParking > 0 ? `
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">Parking Area (${parkingArea} sqft @ 70% rate)</td>
                  <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right;">${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(costs.parking)}</td>
                </tr>` : ""}
                ${parsedWall > 0 ? `
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">Compound Wall (${compoundWallLength} ft @ ₹800/ft)</td>
                  <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right;">${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(costs.wall)}</td>
                </tr>` : ""}
                ${includeSump ? `
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">Sump Tank (${quality} tier capacity)</td>
                  <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right;">${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(costs.sump)}</td>
                </tr>` : ""}
                
                <tr style="background-color: #F8FAFC;">
                  <th style="padding: 12px; text-align: left; color: #1E293B;">Phase wise Structural Splits:</th>
                  <th></th>
                </tr>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="total-box">
              <div class="total-lbl">Grand Total Construction Cost Estimate:</div>
              <div class="total-val">${formattedTotal}</div>
            </div>

            <table class="sign-section">
              <tr>
                <td class="sign-box" style="width: 50%;">
                  Prepared By:<br/>
                  <div class="sign-line"></div>
                  <span style="font-size: 9px; margin-top: 4px; display: block;">HDE Automated Estimator</span>
                </td>
                <td class="sign-box" style="width: 50%; text-align: right;">
                  Client Approval:<br/>
                  <div class="sign-line" style="margin-left: auto;"></div>
                  <span style="font-size: 9px; margin-top: 4px; display: block;">Signature / Date</span>
                </td>
              </tr>
            </table>

            <div class="footer">
              This report is for general budgeting purposes based on regional cost templates and should be verified with your contractor. Local material availability, site conditions, and contractor margins govern final rates.
            </div>
          </body>
        </html>`;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "HDE Cost Estimate" });
    } catch (error) {
      console.error("PDF generation failed:", error);
      Alert.alert("Export Failed", "Failed to build and share PDF report.");
    } finally {
      setIsExporting(false);
    }
  }, [finalTotalCost, breakdownData, quality, area, customRate, parkingArea, compoundWallLength, parsedParking, parsedWall, includeSump, costs]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}>
        {wizardStep === 1 ? (
          <FormStep
            area={area}
            setArea={setArea}
            parkingArea={parkingArea}
            setParkingArea={setParkingArea}
            compoundWallLength={compoundWallLength}
            setCompoundWallLength={setCompoundWallLength}
            includeSump={includeSump}
            setIncludeSump={setIncludeSump}
            quality={quality}
            setQuality={setQuality}
            isEditingRate={isEditingRate}
            setIsEditingRate={setIsEditingRate}
            customRate={customRate}
            setCustomRate={setCustomRate}
            parsedArea={parsedArea}
            setWizardStep={setWizardStep}
          />
        ) : (
          <ResultsStep
            finalTotalCost={finalTotalCost}
            perSqftCost={perSqftCost}
            isSaving={isSaving}
            isExporting={isExporting}
            activeResultsTab={activeResultsTab}
            setActiveResultsTab={setActiveResultsTab}
            selectedSavings={selectedSavings}
            toggleSavingOption={toggleSavingOption}
            breakdownData={breakdownData}
            parsedArea={parsedArea}
            quality={quality}
            includeSump={includeSump}
            handleSave={handleSave}
            handleExportPDF={handleExportPDF}
            setWizardStep={setWizardStep}
          />
        )}
      </ScrollView>
    </View>
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1E293B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 8,
  },
  formContainer: {},
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    height: 48,
  },
  inputWrapperSmall: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    height: 40,
    width: 140,
    marginTop: 4,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#475569",
    marginRight: 6,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#1E293B",
    fontSize: 14,
    height: "100%",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  switchText: {
    flex: 1,
    paddingRight: 12,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 2,
  },
  switchDesc: {
    fontSize: 11,
    color: "#64748B",
  },
  qualityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  qualityBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginHorizontal: 4,
  },
  qualityBtnActive: {
    borderColor: "#D9A443",
    backgroundColor: "#FFFBEB",
    borderWidth: 2,
  },
  qualityBtnText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 4,
  },
  qualityBtnTextActive: {
    color: "#D9A443",
  },
  qualityPrice: {
    fontSize: 11,
    color: "#64748B",
  },
  qualityPriceActive: {
    color: "#B45309",
    fontWeight: "600",
  },
  ratePanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 24,
  },
  rateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rateLabel: {
    fontSize: 12,
    color: "#64748B",
  },
  editRateBtn: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#3B82F6",
  },
  rateValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E293B",
    marginTop: 6,
  },
  btnPrimary: {
    backgroundColor: "#D9A443",
    flexDirection: "row",
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#D9A443",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  btnText: {
    color: "#1E293B",
    fontSize: 15,
    fontWeight: "bold",
  },
  resultsContainer: {},
  kpiCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  kpiTitle: {
    fontSize: 12,
    color: "#94A3B8",
    textTransform: "uppercase",
    fontWeight: "bold",
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#D9A443",
    marginBottom: 4,
  },
  kpiSub: {
    fontSize: 12,
    color: "#FFFFFF",
    opacity: 0.7,
  },
  actionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  btnAction: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 6,
  },
  btnActionText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  resultsTabs: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    padding: 2,
    marginBottom: 16,
  },
  resultsTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  resultsTabBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  resultsTabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  resultsTabBtnTextActive: {
    color: "#1E293B",
    fontWeight: "bold",
  },
  breakdownBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 20,
  },
  boxTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 12,
  },
  boxDesc: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  breakdownPhase: {
    fontSize: 13,
    color: "#475569",
  },
  breakdownCost: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1E293B",
  },
  savingsBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 20,
  },
  savingsOption: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  savingsOptionActive: {
    borderColor: "#D9A443",
    backgroundColor: "#FFFBEB",
  },
  savingsOptionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 2,
  },
  savingsOptionDesc: {
    fontSize: 10,
    color: "#64748B",
  },
  savingsOptionValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#10B981",
    marginLeft: 8,
  },
  btnSecondary: {
    flexDirection: "row",
    height: 48,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  btnSecondaryText: {
    color: "#475569",
    fontSize: 15,
    fontWeight: "bold",
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValueText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#D9A443",
    marginLeft: 8,
    minWidth: 70,
    textAlign: "right",
  },
  iconMarginLeft6: {
    marginLeft: 6,
  },
  iconMarginRight6: {
    marginRight: 6,
  },
  iconMarginRight12: {
    marginRight: 12,
  },
  flexOne: {
    flex: 1,
  },
});

export default ConstructionCalculatorScreen;
