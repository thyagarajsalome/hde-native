import React, { useState, useEffect, useMemo } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../context/UserContext";
import { supabase } from "../services/supabaseClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// ── Constants ──────────────────────────────────────────────────────────────────
const WALL_TYPES = {
  redBrick:  { name: "Red Clay Bricks (9\")",      cementFactor: 1.0, countPerSqFt: 12, unit: "pcs" },
  flyAsh:    { name: "Fly Ash Bricks (9\")",       cementFactor: 0.9, countPerSqFt: 11, unit: "pcs" },
  aac:       { name: "AAC Blocks (8\" thick)",     cementFactor: 0.5, countPerSqFt: 8,  unit: "pcs" },
  ccb:       { name: "Concrete Solid Blocks (6\")",cementFactor: 0.7, countPerSqFt: 9,  unit: "pcs" },
};

const QUALITY_PRESETS = {
  economy:  { label: "Economy",  factor: 0.8 },
  standard: { label: "Standard", factor: 1.0 },
  premium:  { label: "Premium",  factor: 1.3 },
};

const FLOORS_OPTIONS = [1, 2, 3, 4];

const RATES = {
  cement:    380,   // per 50kg bag
  steel:     68,    // per kg
  sand:      55,    // per cft
  aggregate: 42,    // per cft
  brick:     9,     // per piece
  flyash:    7,     
  aac:       55,    
  ccb:       30,    
  paint:     320,   // per litre
  primer:    180,   
  putty:     22,    // per kg
  tiles:     65,    // per sqft
  waterproof:320,   // per litre
  curing:    12,    // per sqft
};

// ── BOQ Engine ─────────────────────────────────────────────────────────────────
interface MaterialRow {
  item: string;
  unit: string;
  qty: number;
  rate: number;
  cost: number;
  brand: string;
}

interface PhaseResult {
  phase: string;
  rows: MaterialRow[];
  subtotal: number;
}

function computeBOQ(
  area: number,
  wallType: keyof typeof WALL_TYPES,
  floors: number,
  quality: keyof typeof QUALITY_PRESETS
): PhaseResult[] {
  const f = QUALITY_PRESETS[quality].factor;
  const wt = WALL_TYPES[wallType];

  const builtUpArea   = area;
  const floorArea     = area / floors;
  const wallArea      = builtUpArea * 2.5;
  const wallVolumeCFT = wallArea * 0.75;
  const concreteVol   = builtUpArea * 0.30;

  // Foundation
  const foundCement  = Math.ceil(builtUpArea * 0.18 * f);
  const foundSteel   = Math.ceil(builtUpArea * 1.2 * f);
  const foundSand    = Math.ceil(builtUpArea * 0.60);
  const foundAgg     = Math.ceil(builtUpArea * 0.50);

  // RCC Structural
  const rccCement = Math.ceil(concreteVol * 0.50 * f);
  const rccSteel  = Math.ceil(builtUpArea * 2.8 * f);
  const rccSand   = Math.ceil(concreteVol * 0.45);
  const rccAgg    = Math.ceil(concreteVol * 0.90);
  const curingAgent = Math.ceil(builtUpArea * 0.5);

  // Masonry
  const brickCount  = Math.ceil(wallArea * wt.countPerSqFt * 1.05);
  const brickRate   = wallType === "redBrick" ? RATES.brick : wallType === "flyAsh" ? RATES.flyash : wallType === "aac" ? RATES.aac : RATES.ccb;
  const msnCement   = Math.ceil(wallVolumeCFT * 0.28 * wt.cementFactor * f);
  const msnSand     = Math.ceil(wallVolumeCFT * 1.10);

  // Plastering
  const plasterArea  = wallArea * 2;
  const plsCement    = Math.ceil(plasterArea * 0.015 * f);
  const plsSand      = Math.ceil(plasterArea * 0.06);

  // Flooring
  const tileArea   = builtUpArea * 1.10;
  const tileCement = Math.ceil(tileArea * 0.012 * f);
  const tileSand   = Math.ceil(tileArea * 0.04);

  // Painting
  const paintableArea = (wallArea + builtUpArea) * 1.1;
  const puttyKg       = Math.ceil(paintableArea * 0.40 * f);
  const primerLtr     = Math.ceil(paintableArea / 100 * 12 * f);
  const paintLtr      = Math.ceil(paintableArea / 100 * 10 * 2);

  // Waterproofing
  const wpArea   = floorArea + (builtUpArea * 0.30);
  const wpLtr    = Math.ceil(wpArea / 50 * 5 * f);

  const r = (base: number) => Math.round(base * f);

  const phases: PhaseResult[] = [
    {
      phase: "Foundation & Substructure",
      rows: [
        { item: "Cement (OPC 53 Grade)", unit: "Bags (50kg)", qty: foundCement, rate: r(RATES.cement), cost: foundCement * r(RATES.cement), brand: "UltraTech / Ambuja" },
        { item: "TMT Steel Bars",        unit: "kg",          qty: foundSteel,  rate: r(RATES.steel),  cost: foundSteel  * r(RATES.steel),  brand: "TATA Tiscon" },
        { item: "Sand / M-Sand",         unit: "cft",         qty: foundSand,   rate: RATES.sand,      cost: foundSand   * RATES.sand,      brand: "Local M-Sand" },
        { item: "Coarse Aggregate 20mm", unit: "cft",         qty: foundAgg,    rate: RATES.aggregate, cost: foundAgg    * RATES.aggregate, brand: "Crushed Granite" },
      ],
      subtotal: 0,
    },
    {
      phase: "RCC Structural Work",
      rows: [
        { item: "Cement (OPC 53 Grade)", unit: "Bags (50kg)", qty: rccCement, rate: r(RATES.cement), cost: rccCement * r(RATES.cement), brand: "UltraTech / ACC" },
        { item: "TMT Steel (Columns/Beams)", unit: "kg",      qty: rccSteel,  rate: r(RATES.steel),  cost: rccSteel  * r(RATES.steel),  brand: "TATA Tiscon / JSW" },
        { item: "Coarse Aggregate 20mm",  unit: "cft",        qty: rccAgg,    rate: RATES.aggregate, cost: rccAgg    * RATES.aggregate, brand: "Crushed Stone" },
        { item: "Curing Compound",        unit: "sqft",       qty: curingAgent, rate: RATES.curing,  cost: curingAgent * RATES.curing,  brand: "Fosroc" },
      ],
      subtotal: 0,
    },
    {
      phase: "Masonry Walls",
      rows: [
        { item: wt.name,                 unit: wt.unit,       qty: brickCount,  rate: brickRate,       cost: brickCount  * brickRate,       brand: "Standard Brick Kiln" },
        { item: "Cement (OPC/PPC)",      unit: "Bags (50kg)", qty: msnCement,   rate: r(RATES.cement), cost: msnCement   * r(RATES.cement), brand: "ACC / Coromandel" },
        { item: "Fine Sand for Mortar",  unit: "cft",         qty: msnSand,     rate: RATES.sand,      cost: msnSand     * RATES.sand,      brand: "Screened Sand" },
      ],
      subtotal: 0,
    },
    {
      phase: "Plastering Work",
      rows: [
        { item: "Cement (OPC/PPC)",      unit: "Bags (50kg)", qty: plsCement,   rate: r(RATES.cement), cost: plsCement   * r(RATES.cement), brand: "Birla Super" },
        { item: "Plastering Sand (Fine)",unit: "cft",         qty: plsSand,     rate: RATES.sand,      cost: plsSand     * RATES.sand,      brand: "Plaster Sand" },
      ],
      subtotal: 0,
    },
    {
      phase: "Flooring & Tiling",
      rows: [
        { item: "Vitrified Tiles (600x600)", unit: "sqft",    qty: Math.round(tileArea), rate: r(RATES.tiles), cost: Math.round(tileArea) * r(RATES.tiles), brand: "Kajaria / Somany" },
        { item: "Tile Adhesive / Cement",   unit: "Bags",     qty: tileCement,  rate: r(RATES.cement), cost: tileCement  * r(RATES.cement), brand: "Roff / Laticrete" },
      ],
      subtotal: 0,
    },
    {
      phase: "Painting & Finishing",
      rows: [
        { item: "Wall Putty (Acrylic)",  unit: "kg",          qty: puttyKg,     rate: RATES.putty,     cost: puttyKg     * RATES.putty,     brand: "Birla White" },
        { item: "Interior Primer",       unit: "Litre",       qty: primerLtr,   rate: RATES.primer,    cost: primerLtr   * RATES.primer,    brand: "Asian Paints" },
        { item: "Premium Acrylic Emulsion", unit: "Litre",    qty: paintLtr,    rate: RATES.paint,     cost: paintLtr    * RATES.paint,     brand: "Asian Paints / Berger" },
      ],
      subtotal: 0,
    },
    {
      phase: "Waterproofing",
      rows: [
        { item: "Waterproofing Compound", unit: "Litre",      qty: wpLtr,       rate: RATES.waterproof,cost: wpLtr       * RATES.waterproof,brand: "Dr Fixit (LW+)" },
      ],
      subtotal: 0,
    },
  ];

  return phases.map((p) => {
    const subtotal = p.rows.reduce((sum, row) => sum + row.cost, 0);
    return { ...p, subtotal };
  });
}

export const MaterialCalculatorScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { hasPaid, markup = 0, user, refreshProfile, planTier, credits } = useUser();
  const editProject = route.params?.projectData;
  const editName = route.params?.projectName;

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Form states
  const [area, setArea] = useState("");
  const [floors, setFloors] = useState(1);
  const [quality, setQuality] = useState<keyof typeof QUALITY_PRESETS>("standard");
  const [wallType, setWallType] = useState<keyof typeof WALL_TYPES>("redBrick");

  // Load project or retrieve draft
  useEffect(() => {
    const loadData = async () => {
      if (editProject) {
        if (editProject.area) setArea(String(editProject.area));
        if (editProject.floors) setFloors(Number(editProject.floors));
        if (editProject.quality) setQuality(editProject.quality);
        if (editProject.wallType) setWallType(editProject.wallType);
        setWizardStep(2);
      } else if (user) {
        try {
          const draftKey = `hde_draft_${user.id}_materials`;
          const savedDraft = await AsyncStorage.getItem(draftKey);
          if (savedDraft) {
            const d = JSON.parse(savedDraft);
            if (d.area) setArea(String(d.area));
            if (d.floors) setFloors(Number(d.floors));
            if (d.quality) setQuality(d.quality);
            if (d.wallType) setWallType(d.wallType);
          }
        } catch (err) {
          console.warn("Failed to load local draft:", err);
        }
      }
    };
    loadData();
  }, [editProject, user]);

  // Debounced draft autosave
  useEffect(() => {
    if (editProject || !user) return;
    if (area) {
      const delay = setTimeout(async () => {
        try {
          const draftKey = `hde_draft_${user.id}_materials`;
          const draftData = { area, floors, quality, wallType };
          await AsyncStorage.setItem(draftKey, JSON.stringify(draftData));
        } catch (err) {
          console.warn("Failed to autosave draft:", err);
        }
      }, 1500);
      return () => clearTimeout(delay);
    }
  }, [area, floors, quality, wallType]);

  const parsedArea = parseFloat(area) || 0;

  const boqData = useMemo(() => {
    if (parsedArea <= 0) return [];
    return computeBOQ(parsedArea, wallType, floors, quality);
  }, [parsedArea, wallType, floors, quality]);

  const totalCost = useMemo(() => {
    return boqData.reduce((sum, phase) => sum + phase.subtotal, 0);
  }, [boqData]);

  const handleSave = async () => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to save this project.", [
        { text: "Cancel" },
        { text: "Sign In", onPress: () => navigation.navigate("Login") },
      ]);
      return;
    }

    if (planTier !== "pro" && credits <= 0) {
      Alert.alert("Upgrade Required", "You have 0 credits remaining. Please upgrade your plan.", [
        { text: "Cancel" },
        { text: "Upgrade", onPress: () => navigation.navigate("Upgrade") },
      ]);
      return;
    }

    Alert.prompt(
      "Save Estimate",
      "Enter a name for this material list:",
      [
        { text: "Cancel" },
        {
          text: "Save",
          onPress: async (name?: string) => {
            if (!name || name.trim() === "") {
              Alert.alert("Error", "Project name is required.");
              return;
            }

            setIsSaving(true);
            try {
              const { error: rpcError } = await supabase.rpc("deduct_project_credit", {
                user_uuid: user.id,
              });

              if (rpcError) {
                if (rpcError.message.includes("limit") || rpcError.message.includes("credits")) {
                  Alert.alert("Error", rpcError.message);
                  return;
                }
                throw rpcError;
              }

              const { error: insertError } = await supabase.from("projects").insert({
                user_id: user.id,
                name: name.trim(),
                type: "materials",
                data: {
                  area,
                  floors,
                  quality,
                  wallType,
                  totalCost: totalCost,
                },
                date: new Date().toISOString(),
              });

              if (insertError) throw insertError;

              await refreshProfile();

              const draftKey = `hde_draft_${user.id}_materials`;
              await AsyncStorage.removeItem(draftKey);

              Alert.alert("Success", "Material estimate saved successfully!");
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
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const formattedDate = new Date().toLocaleDateString("en-IN");
      const formattedTotal = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(totalCost);

      let tableBody = "";
      boqData.forEach((phase) => {
        tableBody += `
          <tr style="background-color: #F1F5F9; font-weight: bold;">
            <td colspan="4" style="padding: 8px;">${phase.phase}</td>
            <td style="padding: 8px; text-align: right;">${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(phase.subtotal)}</td>
          </tr>
        `;
        phase.rows.forEach((row) => {
          tableBody += `
            <tr>
              <td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 11px;">${row.item}</td>
              <td style="padding: 6px; border-bottom: 1px solid #E2E8F0; font-size: 11px;">${row.unit}</td>
              <td style="padding: 6px; border-bottom: 1px solid #E2E8F0; font-size: 11px; text-align: right;">${row.qty}</td>
              <td style="padding: 6px; border-bottom: 1px solid #E2E8F0; font-size: 11px; text-align: right;">₹${row.rate}</td>
              <td style="padding: 6px; border-bottom: 1px solid #E2E8F0; font-size: 11px; text-align: right;">₹${row.cost.toLocaleString("en-IN")}</td>
            </tr>
          `;
        });
      });

      const htmlContent = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #1E293B; }
              .header { border-bottom: 2px solid #D9A443; padding-bottom: 10px; margin-bottom: 20px; }
              .title { font-size: 20px; font-weight: bold; color: #1E293B; }
              .meta { font-size: 11px; color: #64748B; margin-top: 6px; }
              .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              .table th { background-color: #1E293B; color: #FFFFFF; text-align: left; padding: 8px; font-size: 12px; }
              .total-box { margin-top: 30px; background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 16px; border-radius: 12px; }
              .total-lbl { font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: bold; }
              .total-val { font-size: 22px; font-weight: bold; color: #D9A443; margin-top: 4px; }
              .footer { margin-top: 40px; font-size: 9px; color: #94A3B8; font-style: italic; text-align: center; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">HOME DESIGN ENGLISH (HDE)</div>
              <div class="meta">MATERIAL BILL OF QUANTITIES (BOQ) • Generated on ${formattedDate}</div>
            </div>
            <h3>Project Specifications:</h3>
            <p><strong>Built-up Area:</strong> ${area} sq.ft</p>
            <p><strong>Number of Floors:</strong> ${floors}</p>
            <p><strong>Quality Class:</strong> ${QUALITY_PRESETS[quality].label}</p>
            <p><strong>Wall Type:</strong> ${WALL_TYPES[wallType].name}</p>

            <table class="table">
              <thead>
                <tr>
                  <th>Material Item</th>
                  <th>Unit</th>
                  <th style="text-align: right;">Quantity</th>
                  <th style="text-align: right;">Rate</th>
                  <th style="text-align: right;">Estimated Cost</th>
                </tr>
              </thead>
              <tbody>
                ${tableBody}
              </tbody>
            </table>

            <div class="total-box">
              <div class="total-lbl">Total Estimated Material Cost:</div>
              <div class="total-val">${formattedTotal}</div>
            </div>

            <div class="footer">
              Material list forecasts are approximations based on average regional ratios. Local material supplier pricing governs.
            </div>
          </body>
        </html>`;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "HDE Material BOQ" });
    } catch (error) {
      console.error("PDF generation failed:", error);
      Alert.alert("Export Failed", "Failed to build and share material list PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const renderFormStep = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>1. Dimensions & Floors</Text>
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
        </View>

        <Text style={styles.label}>Number of Floors</Text>
        <View style={styles.floorsRow}>
          {FLOORS_OPTIONS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.floorBtn, floors === f ? styles.floorBtnActive : null]}
              onPress={() => setFloors(f)}
            >
              <Text style={[styles.floorBtnTxt, floors === f ? styles.floorBtnTxtActive : null]}>
                G + {f - 1}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>2. Material & Wall Types</Text>
        
        <Text style={styles.label}>Material Grade Class</Text>
        <View style={styles.presetsRow}>
          {Object.entries(QUALITY_PRESETS).map(([k, preset]) => (
            <TouchableOpacity
              key={k}
              style={[styles.presetBtn, quality === k ? styles.presetBtnActive : null]}
              onPress={() => setQuality(k as any)}
            >
              <Text style={[styles.presetBtnTxt, quality === k ? styles.presetBtnTxtActive : null]}>
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Masonry Wall Brick Type</Text>
        <View style={styles.wallSelectContainer}>
          {Object.entries(WALL_TYPES).map(([k, wt]) => (
            <TouchableOpacity
              key={k}
              style={[styles.wallBtn, wallType === k ? styles.wallBtnActive : null]}
              onPress={() => setWallType(k as any)}
            >
              <Ionicons
                name={wallType === k ? "ellipse" : "ellipse-outline"}
                size={16}
                color={wallType === k ? "#D9A443" : "#64748B"}
                style={{ marginRight: 10 }}
              />
              <Text style={[styles.wallBtnTxt, wallType === k ? styles.wallBtnTxtActive : null]}>
                {wt.name}
              </Text>
            </TouchableOpacity>
          ))}
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
          <Text style={styles.btnText}>Generate Material Forecast</Text>
          <Ionicons name="arrow-forward" size={18} color="#1E293B" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderResultsStep = () => {
    const formattedTotal = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(totalCost);

    return (
      <View style={styles.resultsContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiTitle}>Total Material Budget</Text>
          <Text style={styles.kpiValue}>{formattedTotal}</Text>
          <Text style={styles.kpiSub}>Estimated items for {area} sqft</Text>
        </View>

        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.btnAction} onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#64748B" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#475569" />
                <Text style={styles.btnActionText}>Save List</Text>
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

        <Text style={styles.sectionTitle}>Material Specifications</Text>

        {boqData.map((phase) => (
          <View key={phase.phase} style={styles.phaseCard}>
            <View style={styles.phaseHeader}>
              <Text style={styles.phaseTitle}>{phase.phase}</Text>
              <Text style={styles.phaseSubtotal}>
                {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(phase.subtotal)}
              </Text>
            </View>

            {phase.rows.map((row, idx) => (
              <View key={idx} style={styles.rowItem}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowName}>{row.item}</Text>
                  <Text style={styles.rowBrand}>{row.brand}</Text>
                </View>
                <View style={styles.rowNumbers}>
                  <Text style={styles.rowQty}>{row.qty} {row.unit}</Text>
                  <Text style={styles.rowCost}>₹{row.cost.toLocaleString("en-IN")}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => setWizardStep(1)}
        >
          <Ionicons name="arrow-back" size={18} color="#475569" style={{ marginRight: 6 }} />
          <Text style={styles.btnSecondaryText}>Modify Inputs</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {wizardStep === 1 ? renderFormStep() : renderResultsStep()}
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
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#1E293B",
    fontSize: 14,
    height: "100%",
  },
  floorsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  floorBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginHorizontal: 3,
  },
  floorBtnActive: {
    borderColor: "#D9A443",
    backgroundColor: "#FFFBEB",
    borderWidth: 2,
  },
  floorBtnTxt: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#475569",
  },
  floorBtnTxtActive: {
    color: "#D9A443",
  },
  presetsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginHorizontal: 3,
  },
  presetBtnActive: {
    borderColor: "#D9A443",
    backgroundColor: "#FFFBEB",
    borderWidth: 2,
  },
  presetBtnTxt: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#475569",
  },
  presetBtnTxtActive: {
    color: "#D9A443",
  },
  wallSelectContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 4,
    marginBottom: 24,
  },
  wallBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  wallBtnActive: {
    backgroundColor: "#FFFBEB",
  },
  wallBtnTxt: {
    fontSize: 13,
    color: "#475569",
  },
  wallBtnTxtActive: {
    color: "#B45309",
    fontWeight: "bold",
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
  phaseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 16,
  },
  phaseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 10,
    marginBottom: 10,
  },
  phaseTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1E293B",
  },
  phaseSubtotal: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#D9A443",
  },
  rowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  rowMain: {
    flex: 1,
    paddingRight: 12,
  },
  rowName: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  rowBrand: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
  rowNumbers: {
    alignItems: "flex-end",
  },
  rowQty: {
    fontSize: 12,
    color: "#1E293B",
    fontWeight: "600",
  },
  rowCost: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
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
});

export default MaterialCalculatorScreen;
