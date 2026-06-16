import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Dimensions,
  TextInput,
  Modal,
  Platform,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Rect,
  Path,
  Line,
  Circle,
  Text as SvgText,
  G,
  Defs,
  Pattern,
} from "react-native-svg";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Screen dimensions
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CANVAS_SIZE = 400; // Fixed canvas viewport size (square grid)
const GRID_SIZE = 20;

// Conversion: 4 canvas units = 1 foot (1 canvas unit = 3 inches)
const PIXELS_PER_FOOT = 4;

// Color Palette
const COLORS = {
  bg: "#F8FAFC",
  navy: "#1E293B",
  navyLight: "#334155",
  gold: "#D9A443",
  emerald: "#10B981",
  slate: "#64748B",
  slateLight: "#E2E8F0",
  white: "#FFFFFF",
  accent: "#3B82F6",
};

// Interfaces
interface Wall {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number;
}

interface Room {
  id: string;
  label: string; // 'Living Room', 'Bedroom', etc.
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface Opening {
  id: string;
  type: "door" | "window";
  x: number;
  y: number;
  width: number;
  rotation: number; // in degrees
}

interface Furniture {
  id: string;
  type: "bed" | "sofa" | "table" | "toilet" | "sink" | "chair";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export default function FloorPlanScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  
  // App States
  const [viewMode, setViewMode] = useState<"2d" | "3d" | "templates" | "info">("2d");
  const [tool, setTool] = useState<"select" | "room" | "wall" | "door" | "window" | "furniture">("room");
  
  // 3D Orbit States
  const [rotationAngle, setRotationAngle] = useState(45);
  const [tiltAngle, setTiltAngle] = useState(30);
  const [zoomScale, setZoomScale] = useState(0.65);
  
  // Floor Plan Geometry State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [furniture, setFurniture] = useState<Furniture[]>([]);
  
  // Selected Item State for Editing
  const [selectedItem, setSelectedItem] = useState<{
    type: "room" | "wall" | "opening" | "furniture";
    id: string;
  } | null>(null);

  // Drawing Temporary States
  const [tempWallStart, setTempWallStart] = useState<{ x: number; y: number } | null>(null);
  const [tempWallEnd, setTempWallEnd] = useState<{ x: number; y: number } | null>(null);
  
  // Dragging States for Select Mode
  const [draggedItem, setDraggedItem] = useState<{
    type: "room" | "furniture" | "opening";
    id: string;
    offsetX: number;
    offsetY: number;
    initialX: number;
    initialY: number;
    isResizing?: boolean;
  } | null>(null);

  // Construction Rate for pricing estimate (standard Rs. 1600 per sq ft)
  const [ratePerSqFt, setRatePerSqFt] = useState("1600");
  const [projectName, setProjectName] = useState("My Blueprint Project");

  // Load draft project on mount
  useEffect(() => {
    loadDraft();
  }, []);

  // Save draft automatically on state changes
  useEffect(() => {
    if (rooms.length > 0 || walls.length > 0 || openings.length > 0 || furniture.length > 0) {
      saveDraft();
    }
  }, [rooms, walls, openings, furniture]);

  // Save/Load Helper functions
  const saveDraft = async () => {
    try {
      const data = JSON.stringify({ rooms, walls, openings, furniture, projectName });
      await AsyncStorage.setItem("hde_floorplan_draft", data);
    } catch (e) {
      console.error("Failed to save draft floor plan", e);
    }
  };

  const loadDraft = async () => {
    try {
      const saved = await AsyncStorage.getItem("hde_floorplan_draft");
      if (saved) {
        const { rooms: r, walls: w, openings: o, furniture: f, projectName: name } = JSON.parse(saved);
        setRooms(r || []);
        setWalls(w || []);
        setOpenings(o || []);
        setFurniture(f || []);
        if (name) setProjectName(name);
      } else {
        loadTemplate("1bhk"); // default template
      }
    } catch (e) {
      console.error("Failed to load draft floor plan", e);
    }
  };

  const clearCanvas = () => {
    Alert.alert(
      "Reset Layout",
      "Are you sure you want to clear the entire design?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => {
            setRooms([]);
            setWalls([]);
            setOpenings([]);
            setFurniture([]);
            setSelectedItem(null);
            AsyncStorage.removeItem("hde_floorplan_draft");
          },
        },
      ]
    );
  };

  // Predefined Templates
  const loadTemplate = (type: "1bhk" | "2bhk" | "studio") => {
    setSelectedItem(null);
    if (type === "studio") {
      setRooms([
        { id: "r1", label: "Studio Room", x: 40, y: 40, width: 200, height: 200, color: "#E0F2FE" },
        { id: "r2", label: "Bathroom", x: 240, y: 40, width: 120, height: 100, color: "#FEE2E2" },
        { id: "r3", label: "Kitchenette", x: 240, y: 140, width: 120, height: 100, color: "#FEF3C7" },
      ]);
      setWalls([
        { id: "w1", startX: 40, startY: 40, endX: 360, endY: 40, thickness: 8 },
        { id: "w2", startX: 360, startY: 40, endX: 360, endY: 240, thickness: 8 },
        { id: "w3", startX: 360, startY: 240, endX: 40, endY: 240, thickness: 8 },
        { id: "w4", startX: 40, startY: 240, endX: 40, endY: 40, thickness: 8 },
        { id: "w5", startX: 240, startY: 40, endX: 240, endY: 240, thickness: 6 },
        { id: "w6", startX: 240, startY: 140, endX: 360, endY: 140, thickness: 6 },
      ]);
      setOpenings([
        { id: "o1", type: "door", x: 40, y: 120, width: 30, rotation: 90 },
        { id: "o2", type: "door", x: 240, y: 80, width: 25, rotation: 90 },
        { id: "o3", type: "door", x: 240, y: 180, width: 25, rotation: 90 },
        { id: "o4", type: "window", x: 140, y: 40, width: 40, rotation: 0 },
        { id: "o5", type: "window", x: 360, y: 190, width: 30, rotation: 90 },
      ]);
      setFurniture([
        { id: "f1", type: "bed", x: 60, y: 60, width: 70, height: 80, rotation: 0 },
        { id: "f2", type: "sofa", x: 150, y: 170, width: 70, height: 40, rotation: 180 },
        { id: "f3", type: "toilet", x: 310, y: 50, width: 25, height: 35, rotation: 0 },
        { id: "f4", type: "sink", x: 250, y: 50, width: 30, height: 30, rotation: 0 },
      ]);
    } else if (type === "1bhk") {
      setRooms([
        { id: "r1", label: "Living Room", x: 40, y: 40, width: 180, height: 180, color: "#E0F2FE" },
        { id: "r2", label: "Master Bed", x: 220, y: 40, width: 140, height: 180, color: "#ECFDF5" },
        { id: "r3", label: "Kitchen", x: 40, y: 220, width: 180, height: 140, color: "#FEF3C7" },
        { id: "r4", label: "Bathroom", x: 220, y: 220, width: 140, height: 140, color: "#FEE2E2" },
      ]);
      setWalls([
        { id: "w1", startX: 40, startY: 40, endX: 360, endY: 40, thickness: 8 },
        { id: "w2", startX: 360, startY: 40, endX: 360, endY: 360, thickness: 8 },
        { id: "w3", startX: 360, startY: 360, endX: 40, endY: 360, thickness: 8 },
        { id: "w4", startX: 40, startY: 360, endX: 40, endY: 40, thickness: 8 },
        { id: "w5", startX: 220, startY: 40, endX: 220, endY: 360, thickness: 6 },
        { id: "w6", startX: 40, startY: 220, endX: 360, endY: 220, thickness: 6 },
      ]);
      setOpenings([
        { id: "o1", type: "door", x: 40, y: 130, width: 30, rotation: 90 },
        { id: "o2", type: "door", x: 220, y: 80, width: 30, rotation: 90 },
        { id: "o3", type: "door", x: 220, y: 280, width: 25, rotation: 90 },
        { id: "o4", type: "window", x: 120, y: 40, width: 45, rotation: 0 },
        { id: "o5", type: "window", x: 300, y: 40, width: 45, rotation: 0 },
        { id: "o6", type: "window", x: 120, y: 360, width: 45, rotation: 0 },
      ]);
      setFurniture([
        { id: "f1", type: "sofa", x: 60, y: 70, width: 80, height: 40, rotation: 0 },
        { id: "f2", type: "bed", x: 260, y: 60, width: 70, height: 80, rotation: 0 },
        { id: "f3", type: "toilet", x: 280, y: 240, width: 25, height: 35, rotation: 90 },
        { id: "f4", type: "table", x: 70, y: 250, width: 60, height: 40, rotation: 0 },
      ]);
    } else if (type === "2bhk") {
      setRooms([
        { id: "r1", label: "Living Room", x: 40, y: 40, width: 160, height: 160, color: "#E0F2FE" },
        { id: "r2", label: "Master Bed", x: 200, y: 40, width: 160, height: 160, color: "#ECFDF5" },
        { id: "r3", label: "Kids Bed", x: 40, y: 200, width: 160, height: 160, color: "#F5F3FF" },
        { id: "r4", label: "Kitchen", x: 200, y: 200, width: 100, height: 160, color: "#FEF3C7" },
        { id: "r5", label: "Toilet", x: 300, y: 200, width: 60, height: 160, color: "#FEE2E2" },
      ]);
      setWalls([
        { id: "w1", startX: 40, startY: 40, endX: 360, endY: 40, thickness: 8 },
        { id: "w2", startX: 360, startY: 40, endX: 360, endY: 360, thickness: 8 },
        { id: "w3", startX: 360, startY: 360, endX: 40, endY: 360, thickness: 8 },
        { id: "w4", startX: 40, startY: 360, endX: 40, endY: 40, thickness: 8 },
        { id: "w5", startX: 200, startY: 40, endX: 200, endY: 360, thickness: 6 },
        { id: "w6", startX: 40, startY: 200, endX: 360, endY: 200, thickness: 6 },
        { id: "w7", startX: 300, startY: 200, endX: 300, endY: 360, thickness: 6 },
      ]);
      setOpenings([
        { id: "o1", type: "door", x: 40, y: 120, width: 30, rotation: 90 },
        { id: "o2", type: "door", x: 200, y: 80, width: 30, rotation: 90 },
        { id: "o3", type: "door", x: 90, y: 200, width: 30, rotation: 0 },
        { id: "o4", type: "door", x: 240, y: 200, width: 25, rotation: 0 },
        { id: "o5", type: "door", x: 300, y: 250, width: 25, rotation: 90 },
        { id: "o6", type: "window", x: 120, y: 40, width: 40, rotation: 0 },
        { id: "o7", type: "window", x: 280, y: 40, width: 40, rotation: 0 },
        { id: "o8", type: "window", x: 40, y: 280, width: 40, rotation: 90 },
      ]);
      setFurniture([
        { id: "f1", type: "sofa", x: 60, y: 70, width: 80, height: 40, rotation: 0 },
        { id: "f2", type: "bed", x: 240, y: 60, width: 70, height: 80, rotation: 0 },
        { id: "f3", type: "bed", x: 60, y: 220, width: 70, height: 80, rotation: 0 },
        { id: "f4", type: "toilet", x: 320, y: 220, width: 25, height: 35, rotation: 0 },
      ]);
    }
    setViewMode("2d");
  };

  // Math Helpers
  const snap = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  const getRoomArea = (room: Room) => {
    // Area in square feet
    const widthFt = room.width / PIXELS_PER_FOOT;
    const heightFt = room.height / PIXELS_PER_FOOT;
    return Math.round(widthFt * heightFt);
  };

  const getTotalArea = () => {
    return rooms.reduce((acc, room) => acc + getRoomArea(room), 0);
  };

  const getEstimatedCost = () => {
    const totalArea = getTotalArea();
    const rate = parseFloat(ratePerSqFt) || 0;
    return totalArea * rate;
  };

  // Touch handlers for drawing and manipulation
  const handleCanvasTouchStart = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    const snappedX = snap(locationX);
    const snappedY = snap(locationY);

    if (tool === "wall") {
      setTempWallStart({ x: snappedX, y: snappedY });
      setTempWallEnd({ x: snappedX, y: snappedY });
    } else if (tool === "room") {
      const id = "room_" + Date.now();
      const newRoom: Room = {
        id,
        label: "Bedroom",
        x: snappedX - 40 < 0 ? 0 : snappedX - 40,
        y: snappedY - 40 < 0 ? 0 : snappedY - 40,
        width: 80,
        height: 80,
        color: "#E2E8F0",
      };
      setRooms([...rooms, newRoom]);
      setSelectedItem({ type: "room", id });
      setTool("select");
    } else if (tool === "door" || tool === "window") {
      const id = "op_" + Date.now();
      const newOpening: Opening = {
        id,
        type: tool,
        x: snappedX,
        y: snappedY,
        width: tool === "door" ? 30 : 40,
        rotation: 0,
      };
      setOpenings([...openings, newOpening]);
      setSelectedItem({ type: "opening", id });
      setTool("select");
    } else if (tool === "furniture") {
      const id = "furn_" + Date.now();
      const newFurniture: Furniture = {
        id,
        type: "bed",
        x: snappedX - 30,
        y: snappedY - 35,
        width: 60,
        height: 70,
        rotation: 0,
      };
      setFurniture([...furniture, newFurniture]);
      setSelectedItem({ type: "furniture", id });
      setTool("select");
    } else if (tool === "select") {
      // Find what was tapped (prioritize resize handle of selected room, then furniture, then openings, then rooms)
      if (selectedItem && selectedItem.type === "room") {
        const selRoom = rooms.find((r) => r.id === selectedItem.id);
        if (selRoom) {
          // check if tapped bottom-right corner (resize handle)
          const resizeHandleSize = 25;
          const handleX = selRoom.x + selRoom.width;
          const handleY = selRoom.y + selRoom.height;
          if (
            Math.abs(locationX - handleX) < resizeHandleSize &&
            Math.abs(locationY - handleY) < resizeHandleSize
          ) {
            setDraggedItem({
              type: "room",
              id: selRoom.id,
              offsetX: 0,
              offsetY: 0,
              initialX: selRoom.width,
              initialY: selRoom.height,
              isResizing: true,
            });
            return;
          }
        }
      }

      // Check furniture
      const hitFurniture = [...furniture].reverse().find(
        (f) =>
          locationX >= f.x &&
          locationX <= f.x + f.width &&
          locationY >= f.y &&
          locationY <= f.y + f.height
      );
      if (hitFurniture) {
        setSelectedItem({ type: "furniture", id: hitFurniture.id });
        setDraggedItem({
          type: "furniture",
          id: hitFurniture.id,
          offsetX: locationX - hitFurniture.x,
          offsetY: locationY - hitFurniture.y,
          initialX: hitFurniture.x,
          initialY: hitFurniture.y,
        });
        return;
      }

      // Check openings
      const hitOpening = openings.find(
        (o) => Math.abs(locationX - o.x) < 20 && Math.abs(locationY - o.y) < 20
      );
      if (hitOpening) {
        setSelectedItem({ type: "opening", id: hitOpening.id });
        setDraggedItem({
          type: "opening",
          id: hitOpening.id,
          offsetX: locationX - hitOpening.x,
          offsetY: locationY - hitOpening.y,
          initialX: hitOpening.x,
          initialY: hitOpening.y,
        });
        return;
      }

      // Check rooms
      const hitRoom = [...rooms].reverse().find(
        (r) =>
          locationX >= r.x &&
          locationX <= r.x + r.width &&
          locationY >= r.y &&
          locationY <= r.y + r.height
      );
      if (hitRoom) {
        setSelectedItem({ type: "room", id: hitRoom.id });
        setDraggedItem({
          type: "room",
          id: hitRoom.id,
          offsetX: locationX - hitRoom.x,
          offsetY: locationY - hitRoom.y,
          initialX: hitRoom.x,
          initialY: hitRoom.y,
        });
        return;
      }

      setSelectedItem(null);
    }
  };

  const handleCanvasTouchMove = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;

    if (tool === "wall" && tempWallStart) {
      setTempWallEnd({ x: snap(locationX), y: snap(locationY) });
    } else if (tool === "select" && draggedItem) {
      if (draggedItem.type === "room" && draggedItem.isResizing) {
        // Resize Room
        const currentRoom = rooms.find((r) => r.id === draggedItem.id);
        if (currentRoom) {
          const newWidth = Math.max(40, snap(locationX - currentRoom.x));
          const newHeight = Math.max(40, snap(locationY - currentRoom.y));
          setRooms(
            rooms.map((r) =>
              r.id === draggedItem.id ? { ...r, width: newWidth, height: newHeight } : r
            )
          );
        }
      } else {
        // Drag Item
        const newX = snap(locationX - draggedItem.offsetX);
        const newY = snap(locationY - draggedItem.offsetY);
        
        if (draggedItem.type === "room") {
          setRooms(
            rooms.map((r) =>
              r.id === draggedItem.id ? { ...r, x: Math.max(0, newX), y: Math.max(0, newY) } : r
            )
          );
        } else if (draggedItem.type === "furniture") {
          setFurniture(
            furniture.map((f) =>
              f.id === draggedItem.id ? { ...f, x: Math.max(0, newX), y: Math.max(0, newY) } : f
            )
          );
        } else if (draggedItem.type === "opening") {
          setOpenings(
            openings.map((o) =>
              o.id === draggedItem.id ? { ...o, x: Math.max(0, newX), y: Math.max(0, newY) } : o
            )
          );
        }
      }
    }
  };

  const handleCanvasTouchEnd = () => {
    if (tool === "wall" && tempWallStart && tempWallEnd) {
      // Add wall only if it has length
      const length = Math.hypot(tempWallEnd.x - tempWallStart.x, tempWallEnd.y - tempWallStart.y);
      if (length > 15) {
        const id = "wall_" + Date.now();
        const newWall: Wall = {
          id,
          startX: tempWallStart.x,
          startY: tempWallStart.y,
          endX: tempWallEnd.x,
          endY: tempWallEnd.y,
          thickness: 8,
        };
        setWalls([...walls, newWall]);
      }
      setTempWallStart(null);
      setTempWallEnd(null);
    }
    setDraggedItem(null);
  };

  // Edit / Delete helpers for selected items
  const updateSelectedRoomLabel = (label: string) => {
    if (selectedItem && selectedItem.type === "room") {
      const colorsMap: { [key: string]: string } = {
        Bedroom: "#ECFDF5",
        "Master Bed": "#D1FAE5",
        "Living Room": "#E0F2FE",
        Kitchen: "#FEF3C7",
        Bathroom: "#FEE2E2",
        Balcony: "#F0FDF4",
        Hall: "#F0FDFA",
        Dining: "#FAF5FF",
      };
      const color = colorsMap[label] || "#F1F5F9";
      setRooms(
        rooms.map((r) => (r.id === selectedItem.id ? { ...r, label, color } : r))
      );
    }
  };

  const rotateSelectedItem = () => {
    if (!selectedItem) return;
    if (selectedItem.type === "furniture") {
      setFurniture(
        furniture.map((f) =>
          f.id === selectedItem.id ? { ...f, rotation: (f.rotation + 45) % 360 } : f
        )
      );
    } else if (selectedItem.type === "opening") {
      setOpenings(
        openings.map((o) =>
          o.id === selectedItem.id ? { ...o, rotation: (o.rotation + 90) % 360 } : o
        )
      );
    }
  };

  const deleteSelectedItem = () => {
    if (!selectedItem) return;
    const { type, id } = selectedItem;
    if (type === "room") {
      setRooms(rooms.filter((r) => r.id !== id));
    } else if (type === "wall") {
      setWalls(walls.filter((w) => w.id !== id));
    } else if (type === "opening") {
      setOpenings(openings.filter((o) => o.id !== id));
    } else if (type === "furniture") {
      setFurniture(furniture.filter((f) => f.id !== id));
    }
    setSelectedItem(null);
  };

  // PDF Blueprint Generation (ASO features include title & breakdown description)
  const handleExportPDF = async () => {
    const totalArea = getTotalArea();
    const cost = getEstimatedCost();

    // Compile SVG string for inclusion in HTML PDF
    const svgContent = `
      <svg width="600" height="600" viewBox="0 0 400 400" style="background:#ffffff; border: 1px solid #cbd5e1; margin: auto; display: block;">
        <!-- Draw Rooms -->
        ${rooms
          .map(
            (r) => `
          <rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${r.color}" stroke="#64748B" stroke-width="1"/>
          <text x="${r.x + r.width / 2}" y="${r.y + r.height / 2 - 5}" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold" fill="#1E293B">${r.label}</text>
          <text x="${r.x + r.width / 2}" y="${r.y + r.height / 2 + 8}" text-anchor="middle" font-family="Arial" font-size="8" fill="#64748B">${Math.round(r.width / 4)}'x${Math.round(r.height / 4)}' (${Math.round((r.width * r.height) / 16)} sq ft)</text>
        `
          )
          .join("")}
        
        <!-- Draw Walls -->
        ${walls
          .map(
            (w) => `
          <line x1="${w.startX}" y1="${w.startY}" x2="${w.endX}" y2="${w.endY}" stroke="#1E293B" stroke-width="${w.thickness}"/>
        `
          )
          .join("")}

        <!-- Draw Openings -->
        ${openings
          .map((o) => {
            if (o.type === "door") {
              return `<circle cx="${o.x}" cy="${o.y}" r="6" fill="#D9A443"/>
                      <line x1="${o.x}" y1="${o.y}" x2="${o.x + o.width * Math.cos((o.rotation * Math.PI) / 180)}" y2="${o.y + o.width * Math.sin((o.rotation * Math.PI) / 180)}" stroke="#D9A443" stroke-width="3"/>`;
            } else {
              return `<rect x="${o.x - o.width / 2}" y="${o.y - 4}" width="${o.width}" height="8" fill="#FFFFFF" stroke="#3B82F6" stroke-width="2"/>`;
            }
          })
          .join("")}

        <!-- Draw Furniture -->
        ${furniture
          .map(
            (f) => `
          <rect x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}" rx="3" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1" transform="rotate(${f.rotation}, ${f.x + f.width / 2}, ${f.y + f.height / 2})"/>
          <text x="${f.x + f.width / 2}" y="${f.y + f.height / 2 + 3}" text-anchor="middle" font-family="Arial" font-size="6" fill="#64748B" transform="rotate(${f.rotation}, ${f.x + f.width / 2}, ${f.y + f.height / 2})">${f.type.toUpperCase()}</text>
        `
          )
          .join("")}
      </svg>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${projectName}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 30px; }
            h1 { font-size: 24px; color: #1e293b; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
            h2 { font-size: 14px; color: #64748b; font-weight: normal; margin-top: 0; margin-bottom: 25px; }
            .header-table { width: 100%; border-bottom: 2px solid #cbd5e1; padding-bottom: 15px; margin-bottom: 25px; }
            .info-block { font-size: 12px; line-height: 1.6; }
            .badge { background: #d9a443; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; }
            .section-title { font-size: 16px; font-weight: bold; margin-top: 30px; margin-bottom: 15px; border-left: 4px solid #d9a443; padding-left: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
            th { background: #f8fafc; font-weight: bold; }
            .total-row { font-weight: bold; background: #f1f5f9; }
            .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <h1>${projectName}</h1>
                <h2>Architectural 2D Blueprint & Estimator Report</h2>
              </td>
              <td align="right" class="info-block">
                <strong>HDE Platform Report</strong><br>
                Date: ${new Date().toLocaleDateString()}<br>
                Status: <span class="badge">PRO DRAFT</span>
              </td>
            </tr>
          </table>

          <div class="section-title">2D Blueprint Layout Sketch</div>
          ${svgContent}

          <div class="section-title">Dimensions & Space Breakdown</div>
          <table>
            <thead>
              <tr>
                <th>Room Type</th>
                <th>Dimensions (Feet)</th>
                <th>Carpet Area (Sq Ft)</th>
                <th>Layout Color</th>
              </tr>
            </thead>
            <tbody>
              ${rooms
                .map(
                  (r) => `
                <tr>
                  <td><strong>${r.label}</strong></td>
                  <td>${Math.round(r.width / 4)}' x ${Math.round(r.height / 4)}'</td>
                  <td>${getRoomArea(r)} sq ft</td>
                  <td><span style="display:inline-block; width:12px; height:12px; background:${r.color}; border:1px solid #94a3b8; border-radius:2px;"></span></td>
                </tr>
              `
                )
                .join("")}
              <tr class="total-row">
                <td colspan="2">Total Area</td>
                <td colspan="2">${totalArea} sq ft</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">HDE Construction Cost Estimation</div>
          <table>
            <thead>
              <tr>
                <th>Estimation Factor</th>
                <th>Rate value</th>
                <th>Total Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Standard Construction Cost</td>
                <td>Rs. ${ratePerSqFt} / sq ft</td>
                <td><strong>Rs. ${cost.toLocaleString()}</strong></td>
              </tr>
            </tbody>
          </table>
          <p style="font-size: 10px; color: #64748b; font-style: italic; margin-top: 5px;">* This is an automated preliminary estimate calculated via HDE Civil Estimation algorithms based on drawn layout boundaries. Actual rates may fluctuate according to materials selected, finishes, and contractor fees.</p>

          <div class="footer">
            Generated via House Design & Estimation (HDE) app. Smart architectural planning, estimation & builder listing.
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share PDF Blueprint" });
    } catch (error) {
      Alert.alert("Export Error", "Unable to generate PDF blueprint.");
      console.error(error);
    }
  };

  // Navigate to Construction Calculator with preset area
  const handleEstimatePress = () => {
    const totalArea = getTotalArea();
    if (totalArea === 0) {
      Alert.alert("Empty Design", "Please draw or add rooms first to calculate area.");
      return;
    }
    navigation.navigate("ConstructionCalculator", {
      projectData: { area: totalArea.toString() },
      projectName: projectName,
    });
  };

  // Navigate to Material Calculator with preset area
  const handleMaterialEstimatePress = () => {
    const totalArea = getTotalArea();
    if (totalArea === 0) {
      Alert.alert("Empty Design", "Please draw or add rooms first to calculate area.");
      return;
    }
    navigation.navigate("MaterialCalculator", {
      projectData: { area: totalArea.toString() },
      projectName: projectName,
    });
  };

  // Isometric 3D wall & rooms coordinate mapping with rotation, tilt and zoom
  const toIsometric = (x: number, y: number, z: number = 0) => {
    // 1. Rotate around canvas center (200, 200)
    const radRot = (rotationAngle * Math.PI) / 180;
    const dx = x - 200;
    const dy = y - 200;
    const rotX = dx * Math.cos(radRot) - dy * Math.sin(radRot) + 200;
    const rotY = dx * Math.sin(radRot) + dy * Math.cos(radRot) + 200;

    // 2. Project into isometric screen coordinates
    const radTilt = (tiltAngle * Math.PI) / 180;
    const centerX = 200;
    const centerY = 180; // center offset

    const isoX = (rotX - rotY) * Math.cos(30 * Math.PI / 180) * zoomScale + centerX;
    const isoY = ((rotX + rotY) * Math.sin(radTilt) - z) * zoomScale + centerY;

    return { x: isoX, y: isoY, depth: rotY };
  };

  // Render components for 3D Isometric View with painter's algorithm sorting
  const renderIsometricScene = () => {
    const list: React.ReactNode[] = [];
    const wallHeight = 40; // 3D wall extrusion height (pixels)

    // 1. Draw floor slabs (Room polygons) - Ground level, rendered first
    rooms.forEach((room) => {
      const p1 = toIsometric(room.x, room.y);
      const p2 = toIsometric(room.x + room.width, room.y);
      const p3 = toIsometric(room.x + room.width, room.y + room.height);
      const p4 = toIsometric(room.x, room.y + room.height);
      
      list.push(
        <G key={`iso_room_${room.id}`}>
          <Path d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z`} fill={room.color} stroke="#94A3B8" strokeWidth={0.5} />
          {/* Label inside Room floor */}
          <SvgText x={(p1.x + p3.x) / 2} y={(p1.y + p3.y) / 2} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#334155">
            {room.label}
          </SvgText>
        </G>
      );
    });

    // 2. Compile all 3D standing elements (walls, openings, furniture)
    const elementsToRender: { depth: number; element: React.ReactNode; key: string }[] = [];

    // Add 3D Walls
    walls.forEach((w) => {
      // Calculate depth based on wall midpoint
      const midX = (w.startX + w.endX) / 2;
      const midY = (w.startY + w.endY) / 2;
      const midProj = toIsometric(midX, midY);

      // Base points
      const b1 = toIsometric(w.startX, w.startY);
      const b2 = toIsometric(w.endX, w.endY);
      // Top points
      const t1 = toIsometric(w.startX, w.startY, wallHeight);
      const t2 = toIsometric(w.endX, w.endY, wallHeight);

      // Shaded wall colors
      const isHorizontal = Math.abs(w.startY - w.endY) < 5;
      const wallColor = isHorizontal ? "#475569" : "#64748B";
      const topColor = "#94A3B8";

      elementsToRender.push({
        depth: midProj.depth,
        key: `wall_${w.id}`,
        element: (
          <G key={`iso_wall_${w.id}`}>
            {/* Side face */}
            <Path d={`M ${b1.x} ${b1.y} L ${b2.x} ${b2.y} L ${t2.x} ${t2.y} L ${t1.x} ${t1.y} Z`} fill={wallColor} stroke="#334155" strokeWidth={0.5} />
            {/* Top edge of wall */}
            <Line x1={t1.x} y1={t1.y} x2={t2.x} y2={t2.y} stroke={topColor} strokeWidth={w.thickness * 0.7} strokeLinecap="round" />
          </G>
        ),
      });
    });

    // Add 3D Openings
    openings.forEach((op) => {
      const pos = toIsometric(op.x, op.y);
      elementsToRender.push({
        depth: pos.depth,
        key: `op_${op.id}`,
        element: op.type === "door" ? (
          <Circle key={`iso_op_${op.id}`} cx={pos.x} cy={pos.y} r={3} fill="#D9A443" />
        ) : (
          <Circle key={`iso_op_${op.id}`} cx={pos.x} cy={pos.y} r={3} fill="#3B82F6" />
        ),
      });
    });

    // Add 3D Furniture blocks
    furniture.forEach((f) => {
      const w = f.width;
      const h = f.height;
      const zh = 15; // furniture height

      // Depth based on furniture center
      const midX = f.x + w / 2;
      const midY = f.y + h / 2;
      const midProj = toIsometric(midX, midY);

      const b1 = toIsometric(f.x, f.y);
      const b2 = toIsometric(f.x + w, f.y);
      const b3 = toIsometric(f.x + w, f.y + h);
      const b4 = toIsometric(f.x, f.y + h);

      const t1 = toIsometric(f.x, f.y, zh);
      const t2 = toIsometric(f.x + w, f.y, zh);
      const t3 = toIsometric(f.x + w, f.y + h, zh);
      const t4 = toIsometric(f.x, f.y + h, zh);

      elementsToRender.push({
        depth: midProj.depth,
        key: `furn_${f.id}`,
        element: (
          <G key={`iso_furn_${f.id}`}>
            {/* Side faces */}
            <Path d={`M ${b1.x} ${b1.y} L ${b2.x} ${b2.y} L ${t2.x} ${t2.y} L ${t1.x} ${t1.y} Z`} fill="#CBD5E1" stroke="#64748B" strokeWidth={0.5} />
            <Path d={`M ${b2.x} ${b2.y} L ${b3.x} ${b3.y} L ${t3.x} ${t3.y} L ${t2.x} ${t2.y} Z`} fill="#94A3B8" stroke="#64748B" strokeWidth={0.5} />
            {/* Top face */}
            <Path d={`M ${t1.x} ${t1.y} L ${t2.x} ${t2.y} L ${t3.x} ${t3.y} L ${t4.x} ${t4.y} Z`} fill="#E2E8F0" stroke="#64748B" strokeWidth={0.5} />
          </G>
        ),
      });
    });

    // 3. Sort by depth (Painter's algorithm: further objects rendered first, i.e. lower depth/rotY value)
    elementsToRender.sort((a, b) => a.depth - b.depth);

    // 4. Add sorted elements to rendering list
    elementsToRender.forEach((item) => {
      list.push(item.element);
    });

    return list;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <TextInput
          style={styles.projectInput}
          value={projectName}
          onChangeText={(text) => {
            setProjectName(text);
            saveDraft();
          }}
          placeholder="Project Title"
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity style={styles.infoBtn} onPress={() => setViewMode("info")}>
          <Ionicons name="information-circle-outline" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Main Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, viewMode === "2d" && styles.tabActive]}
          onPress={() => setViewMode("2d")}
        >
          <Ionicons name="map-outline" size={16} color={viewMode === "2d" ? COLORS.gold : COLORS.slate} />
          <Text style={[styles.tabText, viewMode === "2d" && styles.tabTextActive]}>2D Canvas</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabBtn, viewMode === "3d" && styles.tabActive]}
          onPress={() => setViewMode("3d")}
        >
          <Ionicons name="cube-outline" size={16} color={viewMode === "3d" ? COLORS.gold : COLORS.slate} />
          <Text style={[styles.tabText, viewMode === "3d" && styles.tabTextActive]}>3D Isometric</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, viewMode === "templates" && styles.tabActive]}
          onPress={() => setViewMode("templates")}
        >
          <Ionicons name="file-tray-full-outline" size={16} color={viewMode === "templates" ? COLORS.gold : COLORS.slate} />
          <Text style={[styles.tabText, viewMode === "templates" && styles.tabTextActive]}>Templates</Text>
        </TouchableOpacity>
      </View>

      {/* Screen Views */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* VIEW 2D EDITOR */}
        {viewMode === "2d" && (
          <View style={styles.editorContainer}>
            {/* Action Bar */}
            <View style={styles.actionsBar}>
              <Text style={styles.tipText}>
                {tool === "select" && "Drag items or resize bottom-right room corners."}
                {tool === "room" && "Tap grid to place a customizable room block."}
                {tool === "wall" && "Touch and drag on grid to draw structural walls."}
                {tool === "door" && "Tap grid to place a door opening."}
                {tool === "window" && "Tap grid to place a window opening."}
                {tool === "furniture" && "Tap grid to place furniture items."}
              </Text>
              <TouchableOpacity style={styles.clearBtn} onPress={clearCanvas}>
                <Ionicons name="trash-outline" size={16} color={COLORS.white} />
                <Text style={styles.clearBtnText}>Reset</Text>
              </TouchableOpacity>
            </View>

            {/* SVG canvas workspace */}
            <View style={styles.canvasContainer}>
              <View
                onTouchStart={handleCanvasTouchStart}
                onTouchMove={handleCanvasTouchMove}
                onTouchEnd={handleCanvasTouchEnd}
                style={styles.canvasTouchReceiver}
              >
                <Svg width={CANVAS_SIZE} height={CANVAS_SIZE}>
                  <Defs>
                    {/* Grid Pattern definition */}
                    <Pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                      <Path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#F1F5F9" strokeWidth="1" />
                    </Pattern>
                  </Defs>

                  {/* Render Grid Background */}
                  <Rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill="url(#grid)" />
                  <Rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill="none" stroke="#E2E8F0" strokeWidth="2" />

                  {/* 1. Draw Rooms */}
                  {rooms.map((room) => {
                    const isSelected = selectedItem?.type === "room" && selectedItem?.id === room.id;
                    return (
                      <G key={room.id}>
                        {/* Floor slab rect */}
                        <Rect
                          x={room.x}
                          y={room.y}
                          width={room.width}
                          height={room.height}
                          fill={room.color}
                          stroke={isSelected ? COLORS.gold : "#94A3B8"}
                          strokeWidth={isSelected ? 2 : 1}
                        />
                        {/* Area Text info */}
                        <SvgText
                          x={room.x + room.width / 2}
                          y={room.y + room.height / 2 - 5}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight="bold"
                          fill="#334155"
                        >
                          {room.label}
                        </SvgText>
                        <SvgText
                          x={room.x + room.width / 2}
                          y={room.y + room.height / 2 + 8}
                          textAnchor="middle"
                          fontSize={8}
                          fill="#64748B"
                        >
                          {Math.round(room.width / PIXELS_PER_FOOT)}' x {Math.round(room.height / PIXELS_PER_FOOT)}' ({getRoomArea(room)} sq ft)
                        </SvgText>

                        {/* Resize handle (Bottom Right Corner) if selected */}
                        {isSelected && (
                          <G>
                            <Circle cx={room.x + room.width} cy={room.y + room.height} r={8} fill={COLORS.gold} />
                            <Line
                              x1={room.x + room.width - 4}
                              y1={room.y + room.height}
                              x2={room.x + room.width + 4}
                              y2={room.y + room.height}
                              stroke="#FFFFFF"
                              strokeWidth={1.5}
                            />
                            <Line
                              x1={room.x + room.width}
                              y1={room.y + room.height - 4}
                              x2={room.x + room.width}
                              y2={room.y + room.height + 4}
                              stroke="#FFFFFF"
                              strokeWidth={1.5}
                            />
                          </G>
                        )}
                      </G>
                    );
                  })}

                  {/* 2. Draw Structural Walls */}
                  {walls.map((wall) => {
                    const isSelected = selectedItem?.type === "wall" && selectedItem?.id === wall.id;
                    return (
                      <Line
                        key={wall.id}
                        x1={wall.startX}
                        y1={wall.startY}
                        x2={wall.endX}
                        y2={wall.endY}
                        stroke={isSelected ? COLORS.gold : COLORS.navy}
                        strokeWidth={wall.thickness}
                        strokeLinecap="round"
                        onPress={() => setSelectedItem({ type: "wall", id: wall.id })}
                      />
                    );
                  })}

                  {/* 3. Draw Openings (Doors / Windows) */}
                  {openings.map((op) => {
                    const isSelected = selectedItem?.type === "opening" && selectedItem?.id === op.id;
                    return (
                      <G key={op.id} transform={`rotate(${op.rotation}, ${op.x}, ${op.y})`}>
                        {op.type === "door" ? (
                          // Swing Door Visual representation
                          <G>
                            {/* Swing arc */}
                            <Path d={`M ${op.x} ${op.y} A ${op.width} ${op.width} 0 0 1 ${op.x + op.width} ${op.y + op.width}`} fill="none" stroke={isSelected ? COLORS.gold : COLORS.gold} strokeWidth={1} strokeDasharray="3,3" />
                            {/* Door post */}
                            <Circle cx={op.x} cy={op.y} r={4} fill={COLORS.gold} />
                            {/* Door leaf panel */}
                            <Line x1={op.x} y1={op.y} x2={op.x} y2={op.y + op.width} stroke={isSelected ? COLORS.gold : "#CD8B23"} strokeWidth={3} />
                          </G>
                        ) : (
                          // Window icon representation
                          <Rect x={op.x - op.width / 2} y={op.y - 4} width={op.width} height={8} fill="#FFFFFF" stroke={isSelected ? COLORS.gold : COLORS.accent} strokeWidth={2} />
                        )}
                      </G>
                    );
                  })}

                  {/* 4. Draw Furniture Objects */}
                  {furniture.map((f) => {
                    const isSelected = selectedItem?.type === "furniture" && selectedItem?.id === f.id;
                    return (
                      <G key={f.id} transform={`rotate(${f.rotation}, ${f.x + f.width / 2}, ${f.y + f.height / 2})`}>
                        <Rect
                          x={f.x}
                          y={f.y}
                          width={f.width}
                          height={f.height}
                          rx={3}
                          fill="#F1F5F9"
                          stroke={isSelected ? COLORS.gold : "#94A3B8"}
                          strokeWidth={isSelected ? 1.5 : 1}
                        />
                        <SvgText x={f.x + f.width / 2} y={f.y + f.height / 2 + 3} textAnchor="middle" fontSize={7} fill="#64748B" fontWeight="500">
                          {f.type.toUpperCase()}
                        </SvgText>
                      </G>
                    );
                  })}

                  {/* 5. Draw Temp Wall line during active drag drawing */}
                  {tempWallStart && tempWallEnd && (
                    <Line
                      x1={tempWallStart.x}
                      y1={tempWallStart.y}
                      x2={tempWallEnd.x}
                      y2={tempWallEnd.y}
                      stroke={COLORS.gold}
                      strokeWidth={8}
                      strokeDasharray="4,4"
                      strokeLinecap="round"
                    />
                  )}
                </Svg>
              </View>
            </View>

            {/* Drawing Tool selection palette */}
            <View style={styles.toolPalette}>
              <TouchableOpacity style={[styles.toolBtn, tool === "select" && styles.toolBtnActive]} onPress={() => setTool("select")}>
                <Ionicons name="hand-left-outline" size={20} color={tool === "select" ? COLORS.gold : COLORS.slate} />
                <Text style={[styles.toolBtnText, tool === "select" && styles.toolBtnTextActive]}>Select</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.toolBtn, tool === "room" && styles.toolBtnActive]} onPress={() => setTool("room")}>
                <Ionicons name="business-outline" size={20} color={tool === "room" ? COLORS.gold : COLORS.slate} />
                <Text style={[styles.toolBtnText, tool === "room" && styles.toolBtnTextActive]}>Room</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.toolBtn, tool === "wall" && styles.toolBtnActive]} onPress={() => setTool("wall")}>
                <Ionicons name="git-commit-outline" size={20} color={tool === "wall" ? COLORS.gold : COLORS.slate} />
                <Text style={[styles.toolBtnText, tool === "wall" && styles.toolBtnTextActive]}>Wall</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.toolBtn, tool === "door" && styles.toolBtnActive]} onPress={() => setTool("door")}>
                <Ionicons name="open-outline" size={20} color={tool === "door" ? COLORS.gold : COLORS.slate} />
                <Text style={[styles.toolBtnText, tool === "door" && styles.toolBtnTextActive]}>Door</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.toolBtn, tool === "window" && styles.toolBtnActive]} onPress={() => setTool("window")}>
                <Ionicons name="square-outline" size={20} color={tool === "window" ? COLORS.gold : COLORS.slate} />
                <Text style={[styles.toolBtnText, tool === "window" && styles.toolBtnTextActive]}>Window</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.toolBtn, tool === "furniture" && styles.toolBtnActive]} onPress={() => setTool("furniture")}>
                <Ionicons name="bed-outline" size={20} color={tool === "furniture" ? COLORS.gold : COLORS.slate} />
                <Text style={[styles.toolBtnText, tool === "furniture" && styles.toolBtnTextActive]}>Furniture</Text>
              </TouchableOpacity>
            </View>

            {/* Properties Panel for Selected Element */}
            {selectedItem && (
              <View style={styles.propertiesPanel}>
                <View style={styles.propHeader}>
                  <Text style={styles.propTitle}>Edit Selected {selectedItem.type.toUpperCase()}</Text>
                  <TouchableOpacity onPress={() => setSelectedItem(null)}>
                    <Ionicons name="close-circle-outline" size={20} color={COLORS.slate} />
                  </TouchableOpacity>
                </View>

                <View style={styles.propBody}>
                  {/* ROOM SPECIFIC PROPERTIES */}
                  {selectedItem.type === "room" && (
                    <View style={styles.roomLabelGroup}>
                      <Text style={styles.label}>Select Room Function:</Text>
                      <View style={styles.chipContainer}>
                        {["Living Room", "Master Bed", "Bedroom", "Kids Bed", "Kitchen", "Bathroom", "Balcony", "Dining"].map((l) => {
                          const activeRoom = rooms.find((r) => r.id === selectedItem.id);
                          const isActive = activeRoom?.label === l;
                          return (
                            <TouchableOpacity
                              key={l}
                              style={[styles.chip, isActive && styles.chipActive]}
                              onPress={() => updateSelectedRoomLabel(l)}
                            >
                              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{l}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* FURNITURE SPECIFIC PROPERTIES */}
                  {selectedItem.type === "furniture" && (
                    <View style={styles.furniturePropGroup}>
                      <Text style={styles.label}>Furniture Item Type:</Text>
                      <View style={styles.chipContainer}>
                        {["bed", "sofa", "table", "toilet", "sink", "chair"].map((type) => {
                          const activeFurn = furniture.find((f) => f.id === selectedItem.id);
                          const isActive = activeFurn?.type === type;
                          return (
                            <TouchableOpacity
                              key={type}
                              style={[styles.chip, isActive && styles.chipActive]}
                              onPress={() => {
                                setFurniture(
                                  furniture.map((f) =>
                                    f.id === selectedItem.id
                                      ? {
                                          ...f,
                                          type: type as any,
                                          width: type === "bed" ? 70 : type === "sofa" ? 80 : 50,
                                          height: type === "bed" ? 80 : type === "sofa" ? 40 : 50,
                                        }
                                      : f
                                  )
                                );
                              }}
                            >
                              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                                {type.toUpperCase()}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Rotator for Openings and Furniture */}
                  {(selectedItem.type === "furniture" || selectedItem.type === "opening") && (
                    <TouchableOpacity style={styles.actionPropBtn} onPress={rotateSelectedItem}>
                      <Ionicons name="refresh-outline" size={16} color={COLORS.navy} style={{ marginRight: 6 }} />
                      <Text style={styles.actionPropBtnText}>Rotate Element (45° / 90°)</Text>
                    </TouchableOpacity>
                  )}

                  {/* Common Delete Action */}
                  <TouchableOpacity style={styles.deletePropBtn} onPress={deleteSelectedItem}>
                    <Ionicons name="trash-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                    <Text style={styles.deletePropBtnText}>Remove Element</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* VIEW 3D ISOMETRIC PREVIEW */}
        {viewMode === "3d" && (
          <View style={styles.viewer3DContainer}>
            <View style={styles.infoCard3D}>
              <Ionicons name="sparkles" size={18} color={COLORS.gold} />
              <Text style={styles.infoCard3DText}>
                Rendered using HDE Isometric Projection Engine. Walls are extruded vertically.
              </Text>
            </View>

            <View style={styles.canvasContainer}>
              <Svg width={CANVAS_SIZE} height={CANVAS_SIZE} style={{ backgroundColor: "#F1F5F9", borderRadius: 12 }}>
                {/* 3D scene elements */}
                {renderIsometricScene()}
              </Svg>
            </View>

            {/* 3D Orbit Controls */}
            <View style={styles.orbitControlsContainer}>
              <Text style={styles.controlSectionTitle}>3D Orbit & Zoom Controls</Text>
              
              <View style={styles.controlRow}>
                {/* Rotation */}
                <View style={styles.controlGroup}>
                  <Text style={styles.controlLabel}>Rotate (Z-Axis)</Text>
                  <View style={styles.buttonGroup}>
                    <TouchableOpacity style={styles.controlBtn} onPress={() => setRotationAngle((prev) => (prev - 15 + 360) % 360)}>
                      <Ionicons name="arrow-undo-outline" size={16} color={COLORS.navy} />
                    </TouchableOpacity>
                    <Text style={styles.controlValueText}>{rotationAngle}°</Text>
                    <TouchableOpacity style={styles.controlBtn} onPress={() => setRotationAngle((prev) => (prev + 15) % 360)}>
                      <Ionicons name="arrow-redo-outline" size={16} color={COLORS.navy} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Tilt */}
                <View style={styles.controlGroup}>
                  <Text style={styles.controlLabel}>Camera Tilt</Text>
                  <View style={styles.buttonGroup}>
                    <TouchableOpacity style={styles.controlBtn} onPress={() => setTiltAngle((prev) => Math.max(15, prev - 5))}>
                      <Ionicons name="trending-down-outline" size={16} color={COLORS.navy} />
                    </TouchableOpacity>
                    <Text style={styles.controlValueText}>{tiltAngle}°</Text>
                    <TouchableOpacity style={styles.controlBtn} onPress={() => setTiltAngle((prev) => Math.min(60, prev + 5))}>
                      <Ionicons name="trending-up-outline" size={16} color={COLORS.navy} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.controlRow}>
                {/* Zoom */}
                <View style={styles.controlGroup}>
                  <Text style={styles.controlLabel}>Zoom / Scale</Text>
                  <View style={styles.buttonGroup}>
                    <TouchableOpacity style={styles.controlBtn} onPress={() => setZoomScale((prev) => Math.max(0.3, prev - 0.05))}>
                      <Ionicons name="remove-circle-outline" size={16} color={COLORS.navy} />
                    </TouchableOpacity>
                    <Text style={styles.controlValueText}>{Math.round(zoomScale * 100)}%</Text>
                    <TouchableOpacity style={styles.controlBtn} onPress={() => setZoomScale((prev) => Math.min(1.2, prev + 0.05))}>
                      <Ionicons name="add-circle-outline" size={16} color={COLORS.navy} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Reset */}
                <TouchableOpacity style={styles.reset3DBtn} onPress={() => { setRotationAngle(45); setTiltAngle(30); setZoomScale(0.65); }}>
                  <Ionicons name="refresh-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.reset3DBtnText}>Reset Camera</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <Text style={styles.placeholder3DNote}>
              * Zooming and rotation coordinates are calculated programmatically. Use the 2D Canvas to alter shapes and wall coordinates.
            </Text>
          </View>
        )}

        {/* VIEW ARCHITECTURAL TEMPLATES */}
        {viewMode === "templates" && (
          <View style={styles.templatesContainer}>
            <Text style={styles.cardTitle}>Load Predefined Blueprints</Text>
            
            <TouchableOpacity style={styles.templateCard} onPress={() => loadTemplate("studio")}>
              <View style={styles.templateIcon}>
                <Ionicons name="home-outline" size={24} color={COLORS.gold} />
              </View>
              <View style={styles.templateContent}>
                <Text style={styles.templateTitle}>1 Room Studio Apartment (320 sq ft)</Text>
                <Text style={styles.templateDesc}>Compact modern studio featuring 1 bathroom, 1 kitchenette, and open bedroom/living area.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.templateCard} onPress={() => loadTemplate("1bhk")}>
              <View style={styles.templateIcon}>
                <Ionicons name="business-outline" size={24} color={COLORS.gold} />
              </View>
              <View style={styles.templateContent}>
                <Text style={styles.templateTitle}>Standard 1 BHK Blueprint (450 sq ft)</Text>
                <Text style={styles.templateDesc}>Classic 1 Bedroom, 1 Hall, 1 Kitchen, and 1 toilet layout ideal for standard plots.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.templateCard} onPress={() => loadTemplate("2bhk")}>
              <View style={styles.templateIcon}>
                <Ionicons name="images-outline" size={24} color={COLORS.gold} />
              </View>
              <View style={styles.templateContent}>
                <Text style={styles.templateTitle}>Standard 2 BHK Layout Plan (800 sq ft)</Text>
                <Text style={styles.templateDesc}>Spacious 2 Bedrooms, 1 large Hall, 1 separate Kitchen, and 1 toilet layout. Best for growing families.</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* VIEW DETAILS & ESTIMATOR SUMMARY */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionHeader}>Blueprint Estimation Report</Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Area</Text>
              <Text style={styles.summaryVal}>{getTotalArea()} sq ft</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Carpet Rooms</Text>
              <Text style={styles.summaryVal}>{rooms.length} Spaces</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Cost Rate (/sq ft)</Text>
              <View style={styles.rateInputWrap}>
                <Text style={styles.rateCurrency}>Rs. </Text>
                <TextInput
                  style={styles.rateInput}
                  keyboardType="numeric"
                  value={ratePerSqFt}
                  onChangeText={setRatePerSqFt}
                />
              </View>
            </View>
          </View>

          {/* Pricing Estimation Banner */}
          <View style={styles.costBanner}>
            <View style={styles.costLeft}>
              <Text style={styles.costTitle}>Est. Construction Cost</Text>
              <Text style={styles.costValue}>Rs. {getEstimatedCost().toLocaleString()}</Text>
            </View>
          </View>

          {/* Calculator Integration Buttons */}
          <View style={styles.calcButtonsRow}>
            <TouchableOpacity style={styles.calcIntegrationBtn} onPress={handleEstimatePress}>
              <Ionicons name="calculator-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
              <Text style={styles.calcIntegrationBtnText}>Estimate Cost</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.calcIntegrationBtn, { backgroundColor: COLORS.gold }]} onPress={handleMaterialEstimatePress}>
              <Ionicons name="cube-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
              <Text style={styles.calcIntegrationBtnText}>Material BOQ</Text>
            </TouchableOpacity>
          </View>

          {/* PDF EXPORT TRIGGER */}
          <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF}>
            <Ionicons name="document-text-outline" size={20} color={COLORS.navy} />
            <Text style={styles.exportBtnText}>Export PDF Blueprint Report</Text>
          </TouchableOpacity>
        </View>

        {/* INFO TAB FOR ASO KEYWORDS & SEO OPTIMIZATION */}
        {viewMode === "info" && (
          <View style={styles.infoSection}>
            <View style={styles.infoHead}>
              <Text style={styles.infoTitle}>ASO Keyword & Blueprint Documentation</Text>
              <TouchableOpacity onPress={() => setViewMode("2d")}>
                <Text style={styles.closeInfoText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.infoBodyScroll}>
              <Text style={styles.infoP}>
                HDE Floor Plan Generator combines a high-performance 2D blueprint drawing board with a real-time isometric 3D visualizer, designed for civil engineers, interior decorators, builders, and homeowners.
              </Text>
              <Text style={styles.infoSubtitle}>Core Blueprint Features Include:</Text>
              <Text style={styles.infoLi}>• <strong>2D Floor Plan sketcher</strong>: Draw walls, create custom rooms, add doors & window openings.</Text>
              <Text style={styles.infoLi}>• <strong>Automatic Area Calculation</strong>: Live square footage calculation per room based on relative carpet size.</Text>
              <Text style={styles.infoLi}>• <strong>3D Isometric Extruder</strong>: Rotate, preview, and see walls stand up in real time.</Text>
              <Text style={styles.infoLi}>• <strong>PDF Blueprint Export</strong>: Download professional PDF layout drawings with area summaries and construction cost breakdown.</Text>
              
              <Text style={styles.infoSubtitle}>Keywords optimized (ASO/SEO):</Text>
              <Text style={styles.infoP}>
                Floor Plan Creator, House design app, Room Planner, Blueprint creator, Construction Cost Calculator, Civil engineering drawing, 3D room design, carpet area estimator, AutoCAD DXF builder, interior planner.
              </Text>
            </ScrollView>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.navy,
  },
  backBtn: {
    padding: 4,
  },
  projectInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.white,
    marginLeft: 12,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.navyLight,
  },
  infoBtn: {
    padding: 4,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateLight,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: COLORS.gold,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.slate,
    marginLeft: 6,
  },
  tabTextActive: {
    color: COLORS.gold,
  },
  scrollContent: {
    backgroundColor: COLORS.bg,
    paddingBottom: 40,
  },
  editorContainer: {
    padding: 16,
  },
  actionsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  tipText: {
    fontSize: 11,
    color: COLORS.slate,
    flex: 1,
    marginRight: 8,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EF4444",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  clearBtnText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "bold",
    marginLeft: 4,
  },
  canvasContainer: {
    alignSelf: "center",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  canvasTouchReceiver: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
  },
  toolPalette: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
    justifyContent: "space-around",
    marginBottom: 16,
  },
  toolBtn: {
    width: "30%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginVertical: 4,
    borderRadius: 10,
  },
  toolBtnActive: {
    backgroundColor: "#D9A44315",
    borderWidth: 1,
    borderColor: "#D9A44330",
  },
  toolBtnText: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.slate,
    marginTop: 4,
  },
  toolBtnTextActive: {
    color: COLORS.gold,
  },
  propertiesPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
    padding: 16,
    marginBottom: 16,
  },
  propHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateLight,
    paddingBottom: 8,
    marginBottom: 12,
  },
  propTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: COLORS.navy,
  },
  propBody: {
    gap: 12,
  },
  roomLabelGroup: {
    gap: 8,
  },
  furniturePropGroup: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.slate,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    backgroundColor: COLORS.bg,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
  },
  chipActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  chipText: {
    fontSize: 11,
    color: COLORS.slate,
  },
  chipTextActive: {
    color: COLORS.white,
    fontWeight: "bold",
  },
  actionPropBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.slateLight,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  actionPropBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.navy,
  },
  deletePropBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  deletePropBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.white,
  },
  viewer3DContainer: {
    padding: 16,
  },
  infoCard3D: {
    flexDirection: "row",
    backgroundColor: "#D9A44315",
    borderWidth: 1,
    borderColor: "#D9A44330",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  infoCard3DText: {
    fontSize: 11,
    color: COLORS.gold,
    flex: 1,
    marginLeft: 8,
  },
  placeholder3DNote: {
    textAlign: "center",
    fontSize: 10,
    color: COLORS.slate,
    marginTop: 10,
  },
  templatesContainer: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.navy,
    marginBottom: 12,
  },
  templateCard: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
    alignItems: "center",
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#D9A44310",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  templateContent: {
    flex: 1,
  },
  templateTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: COLORS.navy,
  },
  templateDesc: {
    fontSize: 11,
    color: COLORS.slate,
    marginTop: 4,
    lineHeight: 15,
  },
  summarySection: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    marginTop: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.navy,
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
  },
  summaryLabel: {
    fontSize: 10,
    color: COLORS.slate,
    fontWeight: "600",
  },
  summaryVal: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.navy,
    marginTop: 4,
  },
  rateInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  rateCurrency: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.navy,
  },
  rateInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "bold",
    color: COLORS.navy,
    padding: 0,
  },
  costBanner: {
    flexDirection: "row",
    backgroundColor: COLORS.emerald,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  costLeft: {
    flex: 1,
  },
  costTitle: {
    color: COLORS.white,
    fontSize: 11,
    opacity: 0.9,
  },
  costValue: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 2,
  },
  estimateCostBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF25",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  estimateCostBtnText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "bold",
    marginRight: 4,
  },
  calcButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  calcIntegrationBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.navy,
    paddingVertical: 12,
    borderRadius: 12,
  },
  calcIntegrationBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "bold",
  },
  orbitControlsContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
    padding: 14,
    marginBottom: 16,
  },
  controlSectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.navy,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 10,
    gap: 12,
  },
  controlGroup: {
    flex: 1,
  },
  controlLabel: {
    fontSize: 11,
    color: COLORS.slate,
    fontWeight: "600",
    marginBottom: 6,
  },
  buttonGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
    padding: 2,
    justifyContent: "space-between",
  },
  controlBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: COLORS.white,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  controlValueText: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.navy,
    minWidth: 32,
    textAlign: "center",
  },
  reset3DBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.navy,
    paddingVertical: 10,
    borderRadius: 8,
  },
  reset3DBtnText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "bold",
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.slateLight,
    paddingVertical: 14,
    borderRadius: 12,
  },
  exportBtnText: {
    fontSize: 13,
    fontWeight: "bold",
    color: COLORS.navy,
    marginLeft: 6,
  },
  infoSection: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 20,
    elevation: 5,
  },
  infoHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateLight,
    paddingBottom: 10,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.navy,
  },
  closeInfoText: {
    color: COLORS.gold,
    fontWeight: "bold",
  },
  infoBodyScroll: {
    flex: 1,
  },
  infoP: {
    fontSize: 12,
    color: COLORS.slate,
    lineHeight: 18,
    marginBottom: 12,
  },
  infoSubtitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: COLORS.navy,
    marginTop: 8,
    marginBottom: 6,
  },
  infoLi: {
    fontSize: 12,
    color: COLORS.slate,
    lineHeight: 18,
    marginBottom: 6,
  },
});
