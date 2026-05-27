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

// ── Pricing Constants ──────────────────────────────────────────────────────────
const FLOORING_TYPES = {
  vitrified: { name: "Vitrified Tiles (600×600)",       rate: 120, wastage: 0.10, labor: 35, brand: "Kajaria / Somany" },
  gvt:       { name: "GVT / PGVT (800×800 High Gloss)", rate: 200, wastage: 0.10, labor: 42, brand: "Kajaria Eternity" },
  marble:    { name: "Indian Marble (Rajasthani White)", rate: 280, wastage: 0.15, labor: 60, brand: "Makrana Marble" },
  granite:   { name: "Granite (Black / Multi-colour)",  rate: 380, wastage: 0.10, labor: 65, brand: "Local Quarry" },
  wood:      { name: "Wooden Laminate (AC4 Grade)",     rate: 160, wastage: 0.05, labor: 30, brand: "Pergo / Kronotex" },
  hardwood:  { name: "Engineered Hardwood (Teak/Oak)",  rate: 450, wastage: 0.08, labor: 55, brand: "Greenply" },
  epoxy:     { name: "Epoxy / 3D Floor Coating",        rate: 95,  wastage: 0.02, labor: 45, brand: "Asian Paints" },
};

const PAINT_TYPES = {
  distemper: { name: "Distemper (Economy)", rate: 22 },
  emulsion: { name: "Tractor Emulsion (Std)", rate: 38 },
  royal: { name: "Royal/Premium Emulsion", rate: 55 },
  texture: { name: "Texture Paint (Highlight)", rate: 120 },
};

const PAINT_PROCESSES = {
  repaint: { name: "Repainting (Touchup + 2 Coats)", factor: 1.0 },
  fresh: { name: "Fresh Painting (Putty + Primer + 2 Coats)", factor: 1.6 },
};

const PLUMBING_UNIT_RATES = {
  kitchen:    { name: "Kitchen (Sink + Taps + Drain)", rate: 13000 },
  commonBath: { name: "Common Bathroom (Basic)",        rate: 28000 },
  masterBath: { name: "Master Bathroom (Premium)",      rate: 50000 },
  motor:      { name: "Motor, Pump & Overhead Tank",    rate: 18000 },
};

const PLUMBING_QUALITY = {
  basic:    { name: "Basic (PVC / Chrome-plated)",      factor: 0.8 },
  standard: { name: "Standard (Jaguar / Parryware)",    factor: 1.0 },
  premium:  { name: "Premium (Grohe / Kohler)",         factor: 1.8 },
};

const ELEC_POINT_RATES = { light: 700, fan: 800, power: 1300, mcb: 28000 };

const ELEC_QUALITY = {
  basic:   { name: "Basic (Anchor/Roma)",        factor: 1.0 },
  premium: { name: "Premium (Legrand/Schneider)", factor: 1.6 },
  smart:   { name: "Smart Home (WiFi/Touch)",     factor: 3.8 },
};

const DOOR_TYPES = {
  flush: { name: "Flush Door (Laminate)", rate: 7000 },
  panel: { name: "Panel Door (Moulded)", rate: 10000 },
  teak: { name: "Teak Wood (Main Door)", rate: 40000 },
};

const WINDOW_TYPES = {
  aluminum: { name: "Aluminum Frame", rate: 450 },
  upvc: { name: "UPVC Frame", rate: 600 },
  wood: { name: "Wooden Frame", rate: 1200 },
};

const INTERIOR_QUALITY_RATES = {
  basic: { name: "Basic", rate: 800 },
  standard: { name: "Standard", rate: 1500 },
  premium: { name: "Premium", rate: 2500 },
};

const INTERIOR_BREAKDOWN = {
  "Modular Kitchen": 30,
  Wardrobes: 25,
  Furniture: 20,
  "False Ceiling & Lighting": 15,
  "Painting & Finishes": 10,
};

export const OtherCalculatorScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { type, projectData, projectName, projectId } = route.params;
  const { hasPaid, markup = 0, user, refreshProfile, planTier, credits, role } = useUser();
  const insets = useSafeAreaInsets();

  const [wizardStep, setWizardStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Dynamic state hooks for forms
  const [carpetArea, setCarpetArea] = useState("");
  const [flooringType, setFlooringType] = useState<keyof typeof FLOORING_TYPES>("vitrified");
  const [includeSkirting, setIncludeSkirting] = useState(true);

  const [includeCeiling, setIncludeCeiling] = useState(true);
  const [paintType, setPaintType] = useState<keyof typeof PAINT_TYPES>("emulsion");
  const [paintProcess, setPaintProcess] = useState<keyof typeof PAINT_PROCESSES>("repaint");

  const [kitchens, setKitchens] = useState("1");
  const [commonBaths, setCommonBaths] = useState("2");
  const [masterBaths, setMasterBaths] = useState("1");
  const [includeMotor, setIncludeMotor] = useState(true);
  const [plumbingQuality, setPlumbingQuality] = useState<keyof typeof PLUMBING_QUALITY>("standard");

  const [lightPoints, setLightPoints] = useState("20");
  const [fanPoints, setFanPoints] = useState("8");
  const [powerPoints, setPowerPoints] = useState("6");
  const [acPoints, setAcPoints] = useState("2");
  const [geyserPoints, setGeyserPoints] = useState("2");
  const [elecQuality, setElecQuality] = useState<keyof typeof ELEC_QUALITY>("basic");

  const [doorCount, setDoorCount] = useState("5");
  const [doorType, setDoorType] = useState<keyof typeof DOOR_TYPES>("flush");
  const [windowCount, setWindowCount] = useState("4");
  const [windowWidth, setWindowWidth] = useState("5");
  const [windowHeight, setWindowHeight] = useState("4");
  const [windowType, setWindowType] = useState<keyof typeof WINDOW_TYPES>("upvc");

  const [interiorQuality, setInteriorQuality] = useState<keyof typeof INTERIOR_QUALITY_RATES>("standard");

  // Load project or retrieve draft
  useEffect(() => {
    const loadState = async () => {
      if (projectData) {
        const d = projectData;
        if (type === "flooring") {
          if (d.area) setCarpetArea(String(d.area));
          if (d.flooringType) setFlooringType(d.flooringType);
          if (d.includeSkirting !== undefined) setIncludeSkirting(Boolean(d.includeSkirting));
        } else if (type === "painting") {
          if (d.carpetArea) setCarpetArea(String(d.carpetArea));
          if (d.paintType) setPaintType(d.paintType);
          if (d.process) setPaintProcess(d.process);
          if (d.includeCeiling !== undefined) setIncludeCeiling(Boolean(d.includeCeiling));
        } else if (type === "plumbing") {
          if (d.kitchens) setKitchens(String(d.kitchens));
          if (d.commonBaths) setCommonBaths(String(d.commonBaths));
          if (d.masterBaths) setMasterBaths(String(d.masterBaths));
          if (d.includeMotor !== undefined) setIncludeMotor(Boolean(d.includeMotor));
          if (d.quality) setPlumbingQuality(d.quality);
        } else if (type === "electrical") {
          if (d.lightPoints) setLightPoints(String(d.lightPoints));
          if (d.fanPoints) setFanPoints(String(d.fanPoints));
          if (d.powerPoints) setPowerPoints(String(d.powerPoints));
          if (d.acPoints) setAcPoints(String(d.acPoints));
          if (d.geyserPoints) setGeyserPoints(String(d.geyserPoints));
          if (d.quality) setElecQuality(d.quality);
        } else if (type === "doors-windows") {
          if (d.doorCount) setDoorCount(String(d.doorCount));
          if (d.doorType) setDoorType(d.doorType);
          if (d.windowCount) setWindowCount(String(d.windowCount));
          if (d.windowType) setWindowType(d.windowType);
          if (d.windowWidth) setWindowWidth(String(d.windowWidth));
          if (d.windowHeight) setWindowHeight(String(d.windowHeight));
        } else if (type === "interior") {
          if (d.area) setCarpetArea(String(d.area));
          if (d.quality) setInteriorQuality(d.quality);
        }
        setWizardStep(2);
      } else if (user) {
        try {
          const draftKey = `hde_draft_${user.id}_${type}`;
          const savedDraft = await AsyncStorage.getItem(draftKey);
          if (savedDraft) {
            const d = JSON.parse(savedDraft);
            if (type === "flooring" || type === "interior") {
              if (d.area) setCarpetArea(String(d.area));
              if (d.flooringType) setFlooringType(d.flooringType);
              if (d.includeSkirting !== undefined) setIncludeSkirting(Boolean(d.includeSkirting));
              if (d.quality) setInteriorQuality(d.quality);
            } else if (type === "painting") {
              if (d.carpetArea) setCarpetArea(String(d.carpetArea));
              if (d.paintType) setPaintType(d.paintType);
              if (d.process) setPaintProcess(d.process);
              if (d.includeCeiling !== undefined) setIncludeCeiling(Boolean(d.includeCeiling));
            } else if (type === "plumbing") {
              if (d.kitchens) setKitchens(String(d.kitchens));
              if (d.commonBaths) setCommonBaths(String(d.commonBaths));
              if (d.masterBaths) setMasterBaths(String(d.masterBaths));
              if (d.includeMotor !== undefined) setIncludeMotor(Boolean(d.includeMotor));
              if (d.quality) setPlumbingQuality(d.quality);
            } else if (type === "electrical") {
              if (d.lightPoints) setLightPoints(String(d.lightPoints));
              if (d.fanPoints) setFanPoints(String(d.fanPoints));
              if (d.powerPoints) setPowerPoints(String(d.powerPoints));
              if (d.acPoints) setAcPoints(String(d.acPoints));
              if (d.geyserPoints) setGeyserPoints(String(d.geyserPoints));
              if (d.quality) setElecQuality(d.quality);
            } else if (type === "doors-windows") {
              if (d.doorCount) setDoorCount(String(d.doorCount));
              if (d.doorType) setDoorType(d.doorType);
              if (d.windowCount) setWindowCount(String(d.windowCount));
              if (d.windowType) setWindowType(d.windowType);
              if (d.windowWidth) setWindowWidth(String(d.windowWidth));
              if (d.windowHeight) setWindowHeight(String(d.windowHeight));
            }
          }
        } catch (err) {
          console.warn("Failed to load local draft:", err);
        }
      }
    };
    loadState();
  }, [projectData, user, type]);

  // Debounced draft autosave
  useEffect(() => {
    if (projectData || !user) return;
    const triggerSave = setTimeout(async () => {
      try {
        const draftKey = `hde_draft_${user.id}_${type}`;
        let draftData = {};
        if (type === "flooring") draftData = { area: carpetArea, flooringType, includeSkirting };
        else if (type === "painting") draftData = { carpetArea, paintType, process: paintProcess, includeCeiling };
        else if (type === "plumbing") draftData = { kitchens, commonBaths, masterBaths, includeMotor, quality: plumbingQuality };
        else if (type === "electrical") draftData = { lightPoints, fanPoints, powerPoints, acPoints, geyserPoints, quality: elecQuality };
        else if (type === "doors-windows") draftData = { doorCount, doorType, windowCount, windowType, windowWidth, windowHeight };
        else if (type === "interior") draftData = { area: carpetArea, quality: interiorQuality };

        await AsyncStorage.setItem(draftKey, JSON.stringify(draftData));
      } catch (err) {
        console.warn("Failed to autosave draft:", err);
      }
    }, 1500);
    return () => clearTimeout(triggerSave);
  }, [carpetArea, flooringType, includeSkirting, includeCeiling, paintType, paintProcess, kitchens, commonBaths, masterBaths, includeMotor, plumbingQuality, lightPoints, fanPoints, powerPoints, acPoints, geyserPoints, elecQuality, doorCount, doorType, windowCount, windowType, windowWidth, windowHeight, interiorQuality]);

  // Calculate Costs
  const calculations = useMemo(() => {
    const parsedArea = parseFloat(carpetArea) || 0;
    const mMultiplier = hasPaid ? (1 + markup / 100) : 1;

    if (type === "flooring") {
      if (parsedArea <= 0) return { total: 0 };
      const ft = FLOORING_TYPES[flooringType];
      const materialCost = parsedArea * (1 + ft.wastage) * ft.rate * mMultiplier;
      const laborCost = parsedArea * ft.labor * mMultiplier;
      const skirtingLen = includeSkirting ? Math.sqrt(parsedArea) * 4 : 0;
      const skirtingCost = includeSkirting ? skirtingLen * (ft.rate * 0.8 + 20) * mMultiplier : 0;
      const suppliesCost = parsedArea * 28 * mMultiplier;
      const polishingCost = (flooringType === "marble" || flooringType === "granite") ? parsedArea * 25 * mMultiplier : 0;
      const total = materialCost + laborCost + skirtingCost + suppliesCost + polishingCost;

      return {
        total,
        breakdown: [
          { name: "Floor Materials", cost: materialCost },
          { name: "Labor Charges", cost: laborCost },
          { name: "Skirting Material & Install", cost: skirtingCost },
          { name: "Supplies (Cement/Sand/Grout)", cost: suppliesCost },
          { name: "Polishing", cost: polishingCost },
        ],
      };
    }

    if (type === "painting") {
      if (parsedArea <= 0) return { total: 0 };
      const wallArea = parsedArea * 3 + (includeCeiling ? parsedArea : 0);
      const total = wallArea * PAINT_TYPES[paintType].rate * PAINT_PROCESSES[paintProcess].factor * mMultiplier;

      return {
        total,
        breakdown: [
          { name: "Paint Material Allocation (45%)", cost: total * 0.45 },
          { name: "Putty & Primer (Fresh check)", cost: total * (paintProcess === "fresh" ? 0.25 : 0.10) },
          { name: "Labor (Installation)", cost: total * (paintProcess === "fresh" ? 0.30 : 0.45) },
        ],
      };
    }

    if (type === "plumbing") {
      const kCount = parseInt(kitchens) || 0;
      const cCount = parseInt(commonBaths) || 0;
      const mCount = parseInt(masterBaths) || 0;
      const f = PLUMBING_QUALITY[plumbingQuality].factor;

      const kitchenCost = kCount * PLUMBING_UNIT_RATES.kitchen.rate * f * mMultiplier;
      const commonCost = cCount * PLUMBING_UNIT_RATES.commonBath.rate * f * mMultiplier;
      const masterCost = mCount * PLUMBING_UNIT_RATES.masterBath.rate * f * mMultiplier;
      const motorCost = includeMotor ? PLUMBING_UNIT_RATES.motor.rate * f * mMultiplier : 0;
      const total = kitchenCost + commonCost + masterCost + motorCost;

      return {
        total,
        breakdown: [
          { name: "Kitchen plumbing points", cost: kitchenCost },
          { name: "Common Bathrooms", cost: commonCost },
          { name: "Master Bathrooms", cost: masterCost },
          { name: "Motor/Pumping System", cost: motorCost },
        ],
      };
    }

    if (type === "electrical") {
      const lCount = parseInt(lightPoints) || 0;
      const fCount = parseInt(fanPoints) || 0;
      const pCount = parseInt(powerPoints) || 0;
      const aCount = parseInt(acPoints) || 0;
      const gCount = parseInt(geyserPoints) || 0;
      const factor = ELEC_QUALITY[elecQuality].factor;

      const lightCost = lCount * ELEC_POINT_RATES.light * factor * mMultiplier;
      const fanCost = fCount * ELEC_POINT_RATES.fan * factor * mMultiplier;
      const powerCost = pCount * ELEC_POINT_RATES.power * factor * mMultiplier;
      const acCost = aCount * ELEC_POINT_RATES.power * 1.5 * factor * mMultiplier;
      const geyserCost = gCount * ELEC_POINT_RATES.power * 1.3 * factor * mMultiplier;
      const boardCost = ELEC_POINT_RATES.mcb * Math.min(factor, 2) * mMultiplier;
      const total = lightCost + fanCost + powerCost + acCost + geyserCost + boardCost;

      return {
        total,
        breakdown: [
          { name: "Light/Plug Sockets", cost: lightCost },
          { name: "Ceiling Fan Points", cost: fanCost },
          { name: "Power Outlets (15A)", cost: powerCost },
          { name: "AC Lines", cost: acCost },
          { name: "Geyser Lines", cost: geyserCost },
          { name: "Distribution Board/MCBs", cost: boardCost },
        ],
      };
    }

    if (type === "doors-windows") {
      const dCount = parseInt(doorCount) || 0;
      const doorCost = dCount * DOOR_TYPES[doorType].rate * mMultiplier;

      const wCount = parseInt(windowCount) || 0;
      const wWidth = parseFloat(windowWidth) || 0;
      const wHeight = parseFloat(windowHeight) || 0;
      const windowCost = wCount * (wWidth * wHeight) * WINDOW_TYPES[windowType].rate * mMultiplier;
      const total = doorCost + windowCost;

      return {
        total,
        breakdown: [
          { name: `Doors (${dCount} units, ${DOOR_TYPES[doorType].name})`, cost: doorCost },
          { name: `Windows (${wCount} units, ${WINDOW_TYPES[windowType].name})`, cost: windowCost },
        ],
      };
    }

    if (type === "interior") {
      if (parsedArea <= 0) return { total: 0 };
      const total = parsedArea * INTERIOR_QUALITY_RATES[interiorQuality].rate * mMultiplier;

      return {
        total,
        breakdown: Object.entries(INTERIOR_BREAKDOWN).map(([comp, pct]) => ({
          name: comp,
          cost: (total * pct) / 100,
        })),
      };
    }

    return { total: 0 };
  }, [type, carpetArea, flooringType, includeSkirting, includeCeiling, paintType, paintProcess, kitchens, commonBaths, masterBaths, includeMotor, plumbingQuality, lightPoints, fanPoints, powerPoints, acPoints, geyserPoints, elecQuality, doorCount, doorType, windowCount, windowType, windowWidth, windowHeight, interiorQuality, hasPaid]);

  const handleSave = async () => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to save estimates.", [
        { text: "Cancel" },
        { text: "Sign In", onPress: () => navigation.navigate("Login") },
      ]);
      return;
    }

    if (!projectId && planTier !== "pro" && credits <= 0) {
      Alert.alert("Upgrade Required", "Insufficient credits. Please upgrade.", [
        { text: "Cancel" },
        { text: "Upgrade", onPress: () => navigation.navigate("Upgrade") },
      ]);
      return;
    }

    Alert.prompt(
      "Save Project",
      "Enter a name for this estimate:",
      [
        { text: "Cancel" },
        {
          text: "Save",
          onPress: async (name?: string) => {
            if (!name || name.trim() === "") {
              Alert.alert("Error", "Name is required");
              return;
            }

            setIsSaving(true);
            try {
              let savePayload = {};
              if (type === "flooring") savePayload = { area: carpetArea, flooringType, includeSkirting };
              else if (type === "painting") savePayload = { carpetArea, paintType, process: paintProcess, includeCeiling };
              else if (type === "plumbing") savePayload = { kitchens, commonBaths, masterBaths, includeMotor, quality: plumbingQuality };
              else if (type === "electrical") savePayload = { lightPoints, fanPoints, powerPoints, acPoints, geyserPoints, quality: elecQuality };
              else if (type === "doors-windows") savePayload = { doorCount, doorType, windowCount, windowType, windowWidth, windowHeight };
              else if (type === "interior") savePayload = { area: carpetArea, quality: interiorQuality };

              let saveError;
              if (projectId) {
                const { error } = await supabase
                  .from("projects")
                  .update({
                    name: name.trim(),
                    data: { ...savePayload, totalCost: calculations.total },
                    date: new Date().toISOString(),
                  })
                  .eq("id", projectId);
                saveError = error;
              } else {
                const { error: rpcError } = await supabase.rpc("deduct_project_credit", {
                  user_uuid: user.id,
                });

                if (rpcError) throw rpcError;

                const { error } = await supabase.from("projects").insert({
                  user_id: user.id,
                  name: name.trim(),
                  type: type,
                  data: { ...savePayload, totalCost: calculations.total },
                  date: new Date().toISOString(),
                });
                saveError = error;
              }

              if (saveError) throw saveError;

              await refreshProfile();

              const draftKey = `hde_draft_${user.id}_${type}`;
              await AsyncStorage.removeItem(draftKey);

              Alert.alert("Success", "Project saved successfully!");
            } catch (err: any) {
              console.error("Save error:", err);
              Alert.alert("Error", "Failed to save project.");
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
      "plain-text",
      projectName || ""
    );
  };

  const handleExportPDF = async () => {
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

    if (!calculations.breakdown) return;
    setIsExporting(true);
    try {
      const formattedDate = new Date().toLocaleDateString("en-IN");
      const formattedTotal = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(calculations.total);

      const rowsHtml = calculations.breakdown
        .map(
          (row) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${row.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right;">
            ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(row.cost)}
          </td>
        </tr>`
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
              <h1 class="logo-title">HDE</h1>
              <div class="report-tag">${type.toUpperCase()} ESTIMATE REPORT • Generated on ${formattedDate}</div>
            </div>

            <table style="width: 100%; margin-bottom: 20px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-collapse: collapse; border-radius: 8px;">
              <tr>
                <td style="padding: 12px 16px; border: 0; font-size: 12px; color: #475569; line-height: 1.6;">
                  <strong>Calculated Dimension Area:</strong> ${carpetArea || "0"} sq.ft<br/>
                  ${type === "flooring" ? `<strong>Include Skirting:</strong> ${includeSkirting ? "Yes" : "No"}<br/><strong>Material Selected:</strong> ${FLOORING_TYPES[flooringType].name}` : ""}
                  ${type === "painting" ? `<strong>Include Ceiling:</strong> ${includeCeiling ? "Yes" : "No"}<br/><strong>Paint Grade:</strong> ${PAINT_TYPES[paintType].name}` : ""}
                  ${type === "interior" ? `<strong>Quality Grade:</strong> ${INTERIOR_QUALITY_RATES[interiorQuality].name}` : ""}
                </td>
              </tr>
            </table>
            
            <table class="table">
              <thead>
                <tr>
                  <th>Estimation Component</th>
                  <th style="text-align: right;">Approx Cost</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="total-box">
              <div class="total-lbl">Total Cost Estimate:</div>
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
              This report is for general budgeting purposes based on HDE standard models and should be verified locally. All estimates are subject to market fluctuations in material and labor rates.
            </div>
          </body>
        </html>`;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `HDE ${type} Report` });
    } catch (error) {
      console.error("PDF export failed:", error);
      Alert.alert("Export Failed", "Failed to build PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const renderForm = () => {
    if (type === "flooring") {
      return (
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Carpet Area (sq. ft.)*</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="resize" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. 800"
                keyboardType="numeric"
                value={carpetArea}
                onChangeText={setCarpetArea}
              />
            </View>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={500}
                maximumValue={5000}
                step={50}
                value={parseFloat(carpetArea) || 500}
                onValueChange={(val) => setCarpetArea(String(val))}
                minimumTrackTintColor="#D9A443"
                maximumTrackTintColor="#CBD5E1"
                thumbTintColor="#D9A443"
              />
              <Text style={styles.sliderValueText}>{parseFloat(carpetArea) || 500} sqft</Text>
            </View>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchLabel}>Include Border Skirting</Text>
              <Text style={styles.switchDesc}>Adds skirting tile length calculation.</Text>
            </View>
            <Switch value={includeSkirting} onValueChange={setIncludeSkirting} trackColor={{ true: "#D9A443" }} />
          </View>

          <Text style={styles.label}>Flooring Type Material</Text>
          <View style={styles.selectorWrapper}>
            {Object.entries(FLOORING_TYPES).map(([k, ft]) => (
              <TouchableOpacity
                key={k}
                style={[styles.selectorBtn, flooringType === k ? styles.selectorBtnActive : null]}
                onPress={() => setFlooringType(k as any)}
              >
                <Ionicons
                  name={flooringType === k ? "radio-button-on" : "radio-button-off"}
                  size={16}
                  color={flooringType === k ? "#D9A443" : "#64748B"}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.selectorText, flooringType === k ? styles.selectorTextActive : null]}>
                  {ft.name} (₹{ft.rate}/sqft)
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    if (type === "painting") {
      return (
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Carpet Area (sq. ft.)*</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="resize" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. 800"
                keyboardType="numeric"
                value={carpetArea}
                onChangeText={setCarpetArea}
              />
            </View>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={500}
                maximumValue={5000}
                step={50}
                value={parseFloat(carpetArea) || 500}
                onValueChange={(val) => setCarpetArea(String(val))}
                minimumTrackTintColor="#D9A443"
                maximumTrackTintColor="#CBD5E1"
                thumbTintColor="#D9A443"
              />
              <Text style={styles.sliderValueText}>{parseFloat(carpetArea) || 500} sqft</Text>
            </View>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchLabel}>Include Ceiling Painting</Text>
              <Text style={styles.switchDesc}>Adds ceiling area to paintable surface area.</Text>
            </View>
            <Switch value={includeCeiling} onValueChange={setIncludeCeiling} trackColor={{ true: "#D9A443" }} />
          </View>

          <Text style={styles.label}>Paint Quality Tier</Text>
          <View style={styles.selectorWrapper}>
            {Object.entries(PAINT_TYPES).map(([k, pt]) => (
              <TouchableOpacity
                key={k}
                style={[styles.selectorBtn, paintType === k ? styles.selectorBtnActive : null]}
                onPress={() => setPaintType(k as any)}
              >
                <Text style={[styles.selectorText, paintType === k ? styles.selectorTextActive : null]}>
                  {pt.name} (₹{pt.rate}/sqft)
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Painting Process</Text>
          <View style={styles.selectorWrapper}>
            {Object.entries(PAINT_PROCESSES).map(([k, pr]) => (
              <TouchableOpacity
                key={k}
                style={[styles.selectorBtn, paintProcess === k ? styles.selectorBtnActive : null]}
                onPress={() => setPaintProcess(k as any)}
              >
                <Text style={[styles.selectorText, paintProcess === k ? styles.selectorTextActive : null]}>
                  {pr.name} (x{pr.factor} cost)
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    if (type === "plumbing") {
      return (
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Number of Kitchens</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} keyboardType="numeric" value={kitchens} onChangeText={setKitchens} />
            </View>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Common Bathrooms</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} keyboardType="numeric" value={commonBaths} onChangeText={setCommonBaths} />
            </View>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Master Bathrooms (Attached Premium)</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} keyboardType="numeric" value={masterBaths} onChangeText={setMasterBaths} />
            </View>
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchLabel}>Include Pumps, Motors & Tank</Text>
            </View>
            <Switch value={includeMotor} onValueChange={setIncludeMotor} trackColor={{ true: "#D9A443" }} />
          </View>

          <Text style={styles.label}>Fixture Material Quality</Text>
          <View style={styles.selectorWrapper}>
            {Object.entries(PLUMBING_QUALITY).map(([k, q]) => (
              <TouchableOpacity
                key={k}
                style={[styles.selectorBtn, plumbingQuality === k ? styles.selectorBtnActive : null]}
                onPress={() => setPlumbingQuality(k as any)}
              >
                <Text style={[styles.selectorText, plumbingQuality === k ? styles.selectorTextActive : null]}>
                  {q.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    if (type === "electrical") {
      return (
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Light & Fan Points (6A)</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} keyboardType="numeric" value={lightPoints} onChangeText={setLightPoints} />
            </View>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Power Points (15A)</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} keyboardType="numeric" value={powerPoints} onChangeText={setPowerPoints} />
            </View>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Dedicated AC Circuits</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} keyboardType="numeric" value={acPoints} onChangeText={setAcPoints} />
            </View>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Geyser Circuits</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} keyboardType="numeric" value={geyserPoints} onChangeText={setGeyserPoints} />
            </View>
          </View>

          <Text style={styles.label}>Switch & DB Quality Brand</Text>
          <View style={styles.selectorWrapper}>
            {Object.entries(ELEC_QUALITY).map(([k, q]) => (
              <TouchableOpacity
                key={k}
                style={[styles.selectorBtn, elecQuality === k ? styles.selectorBtnActive : null]}
                onPress={() => setElecQuality(k as any)}
              >
                <Text style={[styles.selectorText, elecQuality === k ? styles.selectorTextActive : null]}>
                  {q.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    if (type === "doors-windows") {
      return (
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Number of Doors</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} keyboardType="numeric" value={doorCount} onChangeText={setDoorCount} />
            </View>
          </View>
          <Text style={styles.label}>Door Shutter Quality</Text>
          <View style={styles.selectorWrapper}>
            {Object.entries(DOOR_TYPES).map(([k, dt]) => (
              <TouchableOpacity
                key={k}
                style={[styles.selectorBtn, doorType === k ? styles.selectorBtnActive : null]}
                onPress={() => setDoorType(k as any)}
              >
                <Text style={[styles.selectorText, doorType === k ? styles.selectorTextActive : null]}>
                  {dt.name} (₹{dt.rate}/door)
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Number of Windows</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} keyboardType="numeric" value={windowCount} onChangeText={setWindowCount} />
            </View>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Window Width (ft)</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} keyboardType="numeric" value={windowWidth} onChangeText={setWindowWidth} />
            </View>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Window Height (ft)</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} keyboardType="numeric" value={windowHeight} onChangeText={setWindowHeight} />
            </View>
          </View>
          <Text style={styles.label}>Window Frame Type</Text>
          <View style={styles.selectorWrapper}>
            {Object.entries(WINDOW_TYPES).map(([k, wt]) => (
              <TouchableOpacity
                key={k}
                style={[styles.selectorBtn, windowType === k ? styles.selectorBtnActive : null]}
                onPress={() => setWindowType(k as any)}
              >
                <Text style={[styles.selectorText, windowType === k ? styles.selectorTextActive : null]}>
                  {wt.name} (₹{wt.rate}/sqft)
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    if (type === "interior") {
      return (
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Carpet Area (sq. ft.)*</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="resize" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. 1200"
                keyboardType="numeric"
                value={carpetArea}
                onChangeText={setCarpetArea}
              />
            </View>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={500}
                maximumValue={5000}
                step={50}
                value={parseFloat(carpetArea) || 500}
                onValueChange={(val) => setCarpetArea(String(val))}
                minimumTrackTintColor="#D9A443"
                maximumTrackTintColor="#CBD5E1"
                thumbTintColor="#D9A443"
              />
              <Text style={styles.sliderValueText}>{parseFloat(carpetArea) || 500} sqft</Text>
            </View>
          </View>

          <Text style={styles.label}>Interior Finishes Quality</Text>
          <View style={styles.selectorWrapper}>
            {Object.entries(INTERIOR_QUALITY_RATES).map(([k, iq]) => (
              <TouchableOpacity
                key={k}
                style={[styles.selectorBtn, interiorQuality === k ? styles.selectorBtnActive : null]}
                onPress={() => setInteriorQuality(k as any)}
              >
                <Text style={[styles.selectorText, interiorQuality === k ? styles.selectorTextActive : null]}>
                  {iq.name} (₹{iq.rate}/sqft)
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    return null;
  };

  const renderResults = () => {
    const formattedTotal = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(calculations.total);

    return (
      <View style={styles.resultsContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiTitle}>Total Cost Estimate</Text>
          <Text style={styles.kpiValue}>{formattedTotal}</Text>
          <Text style={styles.kpiSub}>Estimated pricing for HDE specification</Text>
        </View>

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

        <Text style={styles.sectionTitle}>Breakdown details</Text>
        <View style={styles.breakdownBox}>
          {calculations.breakdown?.map((row, idx) => (
            <View key={idx} style={styles.breakdownRow}>
              <Text style={styles.breakdownName}>{row.name}</Text>
              <Text style={styles.breakdownCost}>
                {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(row.cost)}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.btnSecondary} onPress={() => setWizardStep(1)}>
          <Text style={styles.btnSecondaryText}>Modify Inputs</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}>
        {wizardStep === 1 ? (
          <View>
            {renderForm()}
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => {
                if ((type === "flooring" || type === "painting" || type === "interior") && (!carpetArea || parseFloat(carpetArea) <= 0)) {
                  Alert.alert("Missing Input", "Please enter a valid area value.");
                  return;
                }
                setWizardStep(2);
              }}
            >
              <Text style={styles.btnText}>Calculate Estimate</Text>
              <Ionicons name="arrow-forward" size={18} color="#1E293B" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        ) : (
          renderResults()
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
    fontSize: 14,
    fontWeight: "bold",
    color: "#1E293B",
    textTransform: "uppercase",
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
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
  selectorWrapper: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 4,
    marginBottom: 20,
  },
  selectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  selectorBtnActive: {
    backgroundColor: "#FFFBEB",
  },
  selectorText: {
    fontSize: 13,
    color: "#475569",
  },
  selectorTextActive: {
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
    marginTop: 16,
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
  breakdownBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  breakdownName: {
    fontSize: 13,
    color: "#475569",
  },
  breakdownCost: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1E293B",
  },
  btnSecondary: {
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
});

export default OtherCalculatorScreen;
