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
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Canvas conversions: 4 canvas units = 1 foot (1 canvas unit = 3 inches)
const PIXELS_PER_FOOT = 4;

const COLORS = {
  cadBg: "#16191C",        // AutoCAD Dark Background
  cadGrid: "#22272B",      // AutoCAD Grid Lines
  cadWall: "#E2E8F0",      // Wall Color
  cadWallBorder: "#475569",// Wall Outline
  cadSelect: "#FF9F1C",    // AutoCAD Gold Selection
  cadDimension: "#00F5D4", // Neon Cyan Dimensioning
  cadDoor: "#D9A443",      // Door Swing Amber
  cadWindow: "#3B82F6",    // Window Blue
  white: "#FFFFFF",
  slate: "#64748B",
  slateLight: "#334155",
  danger: "#EF4444",
};

// Preset room naming chips
const ROOM_NAME_PRESETS = [
  "Master Bed",
  "Bedroom",
  "Living Room",
  "Kitchen",
  "Bathroom",
  "Dining",
  "Balcony",
  "Toilet",
  "Hall",
];

interface Room {
  id: string;
  label: string;
  x: number;      // In pixels
  y: number;      // In pixels
  width: number;  // In pixels
  height: number; // In pixels
  color: string;
}

interface CustomWall {
  id: string;
  x1: number; // In pixels
  y1: number;
  x2: number;
  y2: number;
  thickness: number; // in feet (default 0.5)
}

interface Opening {
  id: string;
  type: "door" | "window";
  x: number; // In pixels
  y: number;
  width: number;
  rotation: number; // 0, 90, 180, 270
}

interface Furniture {
  id: string;
  type: "bed" | "sofa" | "table" | "toilet" | "sink" | "chair";
  x: number; // In pixels
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export default function FloorPlanScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  
  // Layout screen dimensions
  const windowWidth = Dimensions.get("window").width;
  const viewportHeight = Dimensions.get("window").height - 240; // maximize vertical screen real estate

  // View States: 2d editor, 3d orbit mode, 3d walkthrough mode, presets loader
  const [viewMode, setViewMode] = useState<"2d" | "3d" | "walkthrough" | "presets">("2d");
  const [tool, setTool] = useState<"select" | "draw_wall">("select");

  // Geometries State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [customWalls, setCustomWalls] = useState<CustomWall[]>([]);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [furniture, setFurniture] = useState<Furniture[]>([]);
  const [projectName, setProjectName] = useState("My AutoCAD Layout");

  // Selected item tracking
  const [selectedItem, setSelectedItem] = useState<{
    type: "room" | "wall" | "opening" | "furniture";
    id: string;
  } | null>(null);

  // Modals
  const [customRoomModal, setCustomRoomModal] = useState(false);
  const [inputWidthFt, setInputWidthFt] = useState("12");
  const [inputHeightFt, setInputHeightFt] = useState("10");
  const [inputLabel, setInputLabel] = useState("Bedroom");

  // 3D Engine Parameters (unified camera settings)
  const [orbitYaw, setOrbitYaw] = useState(45);
  const [orbitPitch, setOrbitPitch] = useState(35);
  const [zoomScale, setZoomScale] = useState(0.8);
  const [projectionMode, setProjectionMode] = useState<"perspective" | "orthographic">("orthographic");
  
  // First-Person Walkthrough camera (in feet coordinates)
  const [camX, setCamX] = useState(20);
  const [camY, setCamY] = useState(20);
  const [camZ, setCamZ] = useState(5.0); // 5 ft eye-level height
  const [walkYaw, setWalkYaw] = useState(0); // gaze orientation angle
  const [walkPitch, setWalkPitch] = useState(0); // gaze look up/down

  // 2D Zoom/Pan & Web mouse controls
  const [zoom2D, setZoom2D] = useState(1.0);
  const [pan2D, setPan2D] = useState({ x: 0, y: 0 });
  const [isPanning2D, setIsPanning2D] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Touch Tracking references
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const lastTouchX = useRef(0);
  const lastTouchY = useRef(0);
  const [pinchDist, setPinchDist] = useState(0);

  // Free hand wall drawing coordinates
  const [drawingWall, setDrawingWall] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Snapped target indicator for CAD feedback
  const [snapIndicator, setSnapIndicator] = useState<{ x: number; y: number } | null>(null);

  // Touch Drag references
  const [draggedItem, setDraggedItem] = useState<{
    type: "room" | "furniture" | "opening";
    id: string;
    handle?: "move" | "top" | "bottom" | "left" | "right";
    offsetX?: number;
    offsetY?: number;
    childFurniture?: { id: string; relativeX: number; relativeY: number }[];
    childOpenings?: { id: string; relativeX: number; relativeY: number }[];
  } | null>(null);

  useEffect(() => {
    loadDraft();
  }, []);

  useEffect(() => {
    if (rooms.length > 0 || customWalls.length > 0 || openings.length > 0 || furniture.length > 0) {
      saveDraft();
    }
  }, [rooms, customWalls, openings, furniture, projectName]);

  // Load/Save functions
  const saveDraft = async () => {
    try {
      const data = JSON.stringify({ rooms, customWalls, openings, furniture, projectName });
      await AsyncStorage.setItem("hde_cad_floorplan", data);
    } catch (e) {
      console.error(e);
    }
  };

  const centerPlan2D = (customList?: Room[], wallList?: CustomWall[]) => {
    const activeRooms = customList || rooms;
    const activeWalls = wallList || customWalls;

    if (activeRooms.length === 0 && activeWalls.length === 0) {
      setPan2D({ x: 0, y: 0 });
      return;
    }

    let minX = 9999, maxX = -9999, minY = 9999, maxY = -9999;
    activeRooms.forEach(r => {
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.width);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.height);
    });

    activeWalls.forEach(w => {
      minX = Math.min(minX, w.x1, w.x2);
      maxX = Math.max(maxX, w.x1, w.x2);
      minY = Math.min(minY, w.y1, w.y2);
      maxY = Math.max(maxY, w.y1, w.y2);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setPan2D({
      x: windowWidth / 2 - centerX,
      y: viewportHeight / 2 - centerY
    });
  };

  const loadDraft = async () => {
    try {
      const saved = await AsyncStorage.getItem("hde_cad_floorplan");
      if (saved) {
        const { rooms: r, customWalls: cw, openings: o, furniture: f, projectName: name } = JSON.parse(saved);
        setRooms(r || []);
        setCustomWalls(cw || []);
        setOpenings(o || []);
        setFurniture(f || []);
        if (name) setProjectName(name);
        
        setTimeout(() => {
          centerPlan2D(r || [], cw || []);
        }, 100);
      } else {
        loadPresetTemplate("1bhk");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const clearCanvas = () => {
    Alert.alert("Clear Drawing", "Are you sure you want to clear your current blueprint?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: () => {
          setRooms([]);
          setCustomWalls([]);
          setOpenings([]);
          setFurniture([]);
          setSelectedItem(null);
          AsyncStorage.removeItem("hde_cad_floorplan");
        },
      },
    ]);
  };

  // Math Helper: Snap to Grid (1 foot = 4 pixels)
  const snap = (val: number) => Math.round(val / 4) * 4;

  // Find nearest wall end point (CAD Snap Engine)
  const getNearestEndpoint = (x: number, y: number, excludeWallId?: string): { x: number; y: number } | null => {
    let closestDist = 20; // 5 feet snap radius
    let match: { x: number; y: number } | null = null;

    // Check custom walls
    customWalls.forEach((w) => {
      if (w.id === excludeWallId) return;
      const d1 = Math.sqrt(Math.pow(x - w.x1, 2) + Math.pow(y - w.y1, 2));
      if (d1 < closestDist) {
        closestDist = d1;
        match = { x: w.x1, y: w.y1 };
      }
      const d2 = Math.sqrt(Math.pow(x - w.x2, 2) + Math.pow(y - w.y2, 2));
      if (d2 < closestDist) {
        closestDist = d2;
        match = { x: w.x2, y: w.y2 };
      }
    });

    // Check rooms corners
    rooms.forEach((r) => {
      const corners = [
        { x: r.x, y: r.y },
        { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height },
        { x: r.x, y: r.y + r.height },
      ];
      corners.forEach((c) => {
        const d = Math.sqrt(Math.pow(x - c.x, 2) + Math.pow(y - c.y, 2));
        if (d < closestDist) {
          closestDist = d;
          match = c;
        }
      });
    });

    return match;
  };

  // Add room block via area inputs (e.g. 30' x 40')
  const addCustomRoom = () => {
    const wFt = parseFloat(inputWidthFt);
    const hFt = parseFloat(inputHeightFt);

    if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) {
      Alert.alert("Invalid Input", "Please enter positive values for width and length.");
      return;
    }

    const wPixels = wFt * PIXELS_PER_FOOT;
    const hPixels = hFt * PIXELS_PER_FOOT;

    const id = "room_" + Date.now();
    const newRoom: Room = {
      id,
      label: inputLabel,
      x: snap((-pan2D.x + windowWidth / 2) / zoom2D - wPixels / 2),
      y: snap((-pan2D.y + viewportHeight / 2) / zoom2D - hPixels / 2),
      width: wPixels,
      height: hPixels,
      color: "#D9A44315", // Premium gold tint slab
    };

    setRooms([...rooms, newRoom]);
    setSelectedItem({ type: "room", id });
    setCustomRoomModal(false);
    setViewMode("2d");
  };

  // Quick preset rooms
  const dropRoomPreset = (label: string, wFt: number, hFt: number) => {
    const id = "room_" + Date.now();
    const wPixels = wFt * PIXELS_PER_FOOT;
    const hPixels = hFt * PIXELS_PER_FOOT;
    const newRoom: Room = {
      id,
      label,
      x: snap((-pan2D.x + windowWidth / 2) / zoom2D - wPixels / 2),
      y: snap((-pan2D.y + viewportHeight / 2) / zoom2D - hPixels / 2),
      width: wPixels,
      height: hPixels,
      color: "#FFFFFF08",
    };
    setRooms([...rooms, newRoom]);
    setSelectedItem({ type: "room", id });
  };

  // Add Snapped door/window to Room Walls
  const addOpeningToWall = (room: Room, wall: "top" | "bottom" | "left" | "right", type: "door" | "window") => {
    const id = "op_" + Date.now();
    let opX = room.x + room.width / 2;
    let opY = room.y + room.height / 2;
    let rotation = 0;

    if (wall === "top") {
      opX = room.x + room.width / 2;
      opY = room.y;
      rotation = 0;
    } else if (wall === "bottom") {
      opX = room.x + room.width / 2;
      opY = room.y + room.height;
      rotation = 180;
    } else if (wall === "left") {
      opX = room.x;
      opY = room.y + room.height / 2;
      rotation = 270;
    } else if (wall === "right") {
      opX = room.x + room.width;
      opY = room.y + room.height / 2;
      rotation = 90;
    }

    const newOp: Opening = {
      id,
      type,
      x: opX,
      y: opY,
      width: type === "door" ? 12 : 16,
      rotation,
    };

    setOpenings([...openings, newOp]);
    setSelectedItem({ type: "opening", id });
  };

  // Find parent wall snap coordinates
  const getOpeningParentWall = (op: Opening) => {
    if (!op) return null;
    for (const room of rooms) {
      // Top wall
      if (Math.abs(op.y - room.y) < 5 && op.x >= room.x - 5 && op.x <= room.x + room.width + 5) {
        return { room, wall: "top" as const };
      }
      // Bottom wall
      if (Math.abs(op.y - (room.y + room.height)) < 5 && op.x >= room.x - 5 && op.x <= op.x + room.width + 5) {
        return { room, wall: "bottom" as const };
      }
      // Left wall
      if (Math.abs(op.x - room.x) < 5 && op.y >= room.y - 5 && op.y <= room.y + room.height + 5) {
        return { room, wall: "left" as const };
      }
      // Right wall
      if (Math.abs(op.x - (room.x + room.width)) < 5 && op.y >= room.y - 5 && op.y <= room.y + room.height + 5) {
        return { room, wall: "right" as const };
      }
    }
    return null;
  };

  const snapOpeningToWalls = (x: number, y: number): { x: number; y: number; rotation: number } => {
    let closestDist = 12; // Snap radius (approx 3 ft)
    let bestSnap = { x: snap(x), y: snap(y), rotation: 0 };

    // Check rooms walls
    rooms.forEach(r => {
      // Top wall
      if (Math.abs(y - r.y) < closestDist && x >= r.x - 5 && x <= r.x + r.width + 5) {
        closestDist = Math.abs(y - r.y);
        bestSnap = { x: snap(x), y: r.y, rotation: 0 };
      }
      // Bottom wall
      if (Math.abs(y - (r.y + r.height)) < closestDist && x >= r.x - 5 && x <= r.x + r.width + 5) {
        closestDist = Math.abs(y - (r.y + r.height));
        bestSnap = { x: snap(x), y: r.y + r.height, rotation: 180 };
      }
      // Left wall
      if (Math.abs(x - r.x) < closestDist && y >= r.y - 5 && y <= r.y + r.height + 5) {
        closestDist = Math.abs(x - r.x);
        bestSnap = { x: r.x, y: snap(y), rotation: 270 };
      }
      // Right wall
      if (Math.abs(x - (r.x + r.width)) < closestDist && y >= r.y - 5 && y <= r.y + r.height + 5) {
        closestDist = Math.abs(x - (r.x + r.width));
        bestSnap = { x: r.x + r.width, y: snap(y), rotation: 90 };
      }
    });

    // Check custom walls
    customWalls.forEach(w => {
      const l2 = Math.pow(w.x2 - w.x1, 2) + Math.pow(w.y2 - w.y1, 2);
      if (l2 === 0) return;
      const t = Math.max(0, Math.min(1, ((x - w.x1) * (w.x2 - w.x1) + (y - w.y1) * (w.y2 - w.y1)) / l2));
      const projX = w.x1 + t * (w.x2 - w.x1);
      const projY = w.y1 + t * (w.y2 - w.y1);
      const dist = Math.sqrt(Math.pow(x - projX, 2) + Math.pow(y - projY, 2));

      if (dist < closestDist) {
        closestDist = dist;
        const angle = Math.round((Math.atan2(w.y2 - w.y1, w.x2 - w.x1) * 180) / Math.PI);
        bestSnap = { x: snap(projX), y: snap(projY), rotation: angle };
      }
    });

    return bestSnap;
  };

  const addOpening = (type: "door" | "window") => {
    const id = "op_" + Date.now();
    const width = type === "door" ? 12 : 16;
    
    // Drop at screen center
    const dropX = snap((-pan2D.x + windowWidth / 2) / zoom2D);
    const dropY = snap((-pan2D.y + viewportHeight / 2) / zoom2D);

    const newOp: Opening = {
      id,
      type,
      x: dropX,
      y: dropY,
      width,
      rotation: 0,
    };

    setOpenings([...openings, newOp]);
    setSelectedItem({ type: "opening", id });
  };

  // Add elements
  const addFurniture = (type: "bed" | "sofa" | "table" | "toilet" | "sink" | "chair") => {
    const id = "furn_" + Date.now();
    let width = 16;
    let height = 12;

    if (type === "bed") {
      width = 20; // 5.0 ft
      height = 26; // 6.5 ft
    } else if (type === "sofa") {
      width = 24; // 6.0 ft
      height = 12; // 3.0 ft
    } else if (type === "table") {
      width = 16; // 4.0 ft
      height = 12; // 3.0 ft
    } else if (type === "toilet") {
      width = 8; // 2.0 ft
      height = 10; // 2.5 ft
    } else if (type === "sink") {
      width = 8; // 2.0 ft
      height = 6; // 1.5 ft
    } else if (type === "chair") {
      width = 6; // 1.5 ft
      height = 6; // 1.5 ft
    }

    const newFurn: Furniture = {
      id,
      type,
      x: snap((-pan2D.x + windowWidth / 2) / zoom2D - width / 2),
      y: snap((-pan2D.y + viewportHeight / 2) / zoom2D - height / 2),
      width,
      height,
      rotation: 0,
    };
    setFurniture([...furniture, newFurn]);
    setSelectedItem({ type: "furniture", id });
  };

  const adjustRoomWidth = (roomId: string, incrementFt: number) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        const currentFt = r.width / PIXELS_PER_FOOT;
        const newFt = Math.max(4, currentFt + incrementFt);
        return { ...r, width: snap(newFt * PIXELS_PER_FOOT) };
      }
      return r;
    }));
  };

  const adjustRoomHeight = (roomId: string, incrementFt: number) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        const currentFt = r.height / PIXELS_PER_FOOT;
        const newFt = Math.max(4, currentFt + incrementFt);
        return { ...r, height: snap(newFt * PIXELS_PER_FOOT) };
      }
      return r;
    }));
  };

  const changeRoomLabel = (label: string) => {
    if (selectedItem && selectedItem.type === "room") {
      setRooms(rooms.map(r => r.id === selectedItem.id ? { ...r, label } : r));
    }
  };

  const rotateElement = () => {
    if (!selectedItem) return;
    if (selectedItem.type === "furniture") {
      setFurniture(furniture.map(f => f.id === selectedItem.id ? { ...f, rotation: (f.rotation + 45) % 360 } : f));
    } else if (selectedItem.type === "opening") {
      setOpenings(openings.map(o => o.id === selectedItem.id ? { ...o, rotation: (o.rotation + 90) % 360 } : o));
    }
  };

  const deleteElement = () => {
    if (!selectedItem) return;
    const { type, id } = selectedItem;
    if (type === "room") setRooms(rooms.filter(r => r.id !== id));
    else if (type === "wall") setCustomWalls(customWalls.filter(w => w.id !== id));
    else if (type === "opening") setOpenings(openings.filter(o => o.id !== id));
    else if (type === "furniture") setFurniture(furniture.filter(f => f.id !== id));
    setSelectedItem(null);
  };

  // Compile all layout walls (Rooms boundaries + Custom drawn lines)
  const getCompilationWalls = (): CustomWall[] => {
    const list: CustomWall[] = [...customWalls];
    rooms.forEach(r => {
      list.push({ id: `${r.id}_top`, x1: r.x, y1: r.y, x2: r.x + r.width, y2: r.y, thickness: 0.5 });
      list.push({ id: `${r.id}_bot`, x1: r.x, y1: r.y + r.height, x2: r.x + r.width, y2: r.y + r.height, thickness: 0.5 });
      list.push({ id: `${r.id}_lft`, x1: r.x, y1: r.y, x2: r.x, y2: r.y + r.height, thickness: 0.5 });
      list.push({ id: `${r.id}_rgt`, x1: r.x + r.width, y1: r.y, x2: r.x + r.width, y2: r.y + r.height, thickness: 0.5 });
    });
    return list;
  };

  // Touch Gestures: 2D drawing & 3D camera controls
  const handleTouchStart = (e: any) => {
    const { locationX, locationY, touches } = e.nativeEvent;

    // 1. Zoom Pinch check
    if (touches && touches.length === 2) {
      const t1 = touches[0];
      const t2 = touches[1];
      const dist = Math.sqrt(Math.pow(t1.locationX - t2.locationX, 2) + Math.pow(t1.locationY - t2.locationY, 2));
      setPinchDist(dist);
      return;
    }

    setTouchStartX(locationX);
    setTouchStartY(locationY);
    lastTouchX.current = locationX;
    lastTouchY.current = locationY;

    if (viewMode !== "2d") return; // 3D handles gestures on drag move only

    // Compute canvas coordinates for 2D calculations
    const calcX = (locationX - pan2D.x) / zoom2D;
    const calcY = (locationY - pan2D.y) / zoom2D;

    // 2. Custom Wall Drawing mode
    if (tool === "draw_wall") {
      const snapStart = getNearestEndpoint(calcX, calcY);
      const startX = snapStart ? snapStart.x : snap(calcX);
      const startY = snapStart ? snapStart.y : snap(calcY);
      setDrawingWall({ x1: startX, y1: startY, x2: startX, y2: startY });
      return;
    }

    // 3. Select Mode Hit Checks
    // Check handles resize hit of selected room
    if (selectedItem && selectedItem.type === "room") {
      const room = rooms.find(r => r.id === selectedItem.id);
      if (room) {
        const hSize = 25 / zoom2D; // Scale hit area with zoom
        if (Math.abs(calcX - (room.x + room.width)) < hSize && Math.abs(calcY - (room.y + room.height/2)) < hSize) {
          setDraggedItem({ type: "room", id: room.id, handle: "right" });
          return;
        }
        if (Math.abs(calcX - room.x) < hSize && Math.abs(calcY - (room.y + room.height/2)) < hSize) {
          setDraggedItem({ type: "room", id: room.id, handle: "left" });
          return;
        }
        if (Math.abs(calcX - (room.x + room.width/2)) < hSize && Math.abs(calcY - (room.y + room.height)) < hSize) {
          setDraggedItem({ type: "room", id: room.id, handle: "bottom" });
          return;
        }
        if (Math.abs(calcX - (room.x + room.width/2)) < hSize && Math.abs(calcY - room.y) < hSize) {
          setDraggedItem({ type: "room", id: room.id, handle: "top" });
          return;
        }
      }
    }

    // Check furniture hits
    const hitFurn = [...furniture].reverse().find(
      f => calcX >= f.x && calcX <= f.x + f.width && calcY >= f.y && calcY <= f.y + f.height
    );
    if (hitFurn) {
      setSelectedItem({ type: "furniture", id: hitFurn.id });
      setDraggedItem({ type: "furniture", id: hitFurn.id, handle: "move", offsetX: calcX - hitFurn.x, offsetY: calcY - hitFurn.y });
      return;
    }

    // Check openings hits
    const hitOp = openings.find(
      o => Math.abs(calcX - o.x) < 22 / zoom2D && Math.abs(calcY - o.y) < 22 / zoom2D
    );
    if (hitOp) {
      setSelectedItem({ type: "opening", id: hitOp.id });
      setDraggedItem({ type: "opening", id: hitOp.id, handle: "move" });
      return;
    }

    // Check custom walls hits
    const hitWall = customWalls.find(w => {
      const l2 = Math.pow(w.x2 - w.x1, 2) + Math.pow(w.y2 - w.y1, 2);
      if (l2 === 0) return false;
      const t = Math.max(0, Math.min(1, ((calcX - w.x1) * (w.x2 - w.x1) + (calcY - w.y1) * (w.y2 - w.y1)) / l2));
      const projX = w.x1 + t * (w.x2 - w.x1);
      const projY = w.y1 + t * (w.y2 - w.y1);
      const dist = Math.sqrt(Math.pow(calcX - projX, 2) + Math.pow(calcY - projY, 2));
      return dist < 12 / zoom2D;
    });
    if (hitWall) {
      setSelectedItem({ type: "wall", id: hitWall.id });
      return;
    }

    // Check rooms hits
    const hitRoom = [...rooms].reverse().find(
      r => calcX >= r.x && calcX <= r.x + r.width && calcY >= r.y && calcY <= r.y + r.height
    );
    if (hitRoom) {
      setSelectedItem({ type: "room", id: hitRoom.id });
      const childFurniture = furniture.filter(f => 
        f.x >= hitRoom.x && f.x + f.width <= hitRoom.x + hitRoom.width && f.y >= hitRoom.y && f.y + f.height <= hitRoom.y + hitRoom.height
      ).map(f => ({ id: f.id, relativeX: f.x - hitRoom.x, relativeY: f.y - hitRoom.y }));

      const childOpenings = openings.filter(op => {
        const onTop = Math.abs(op.y - hitRoom.y) < 5 && op.x >= hitRoom.x - 5 && op.x <= hitRoom.x + hitRoom.width + 5;
        const onBottom = Math.abs(op.y - (hitRoom.y + hitRoom.height)) < 5 && op.x >= hitRoom.x - 5 && op.x <= hitRoom.x + hitRoom.width + 5;
        const onLeft = Math.abs(op.x - hitRoom.x) < 5 && op.y >= hitRoom.y - 5 && op.y <= hitRoom.y + hitRoom.height + 5;
        const onRight = Math.abs(op.x - (hitRoom.x + hitRoom.width)) < 5 && op.y >= hitRoom.y - 5 && op.y <= hitRoom.y + hitRoom.height + 5;
        return onTop || onBottom || onLeft || onRight;
      }).map(op => ({ id: op.id, relativeX: op.x - hitRoom.x, relativeY: op.y - hitRoom.y }));

      setDraggedItem({
        type: "room",
        id: hitRoom.id,
        handle: "move",
        offsetX: calcX - hitRoom.x,
        offsetY: calcY - hitRoom.y,
        childFurniture,
        childOpenings
      });
      return;
    }

    // If nothing hit, start panning in select tool
    if (tool === "select") {
      setIsPanning2D(true);
      setPanStart({ x: pan2D.x, y: pan2D.y });
    } else {
      setSelectedItem(null);
    }
  };

  const handleTouchMove = (e: any) => {
    const { locationX, locationY, touches } = e.nativeEvent;

    // 1. Pinch zoom gesture
    if (touches && touches.length === 2 && viewMode === "3d") {
      const t1 = touches[0];
      const t2 = touches[1];
      const dist = Math.sqrt(Math.pow(t1.locationX - t2.locationX, 2) + Math.pow(t1.locationY - t2.locationY, 2));
      if (pinchDist > 0) {
        const ratio = dist / pinchDist;
        setZoomScale(prev => Math.max(0.2, Math.min(2.5, prev * ratio)));
      }
      setPinchDist(dist);
      return;
    }

    // Incremental drag movement tracking (synchronous via refs to prevent stale closure state lag)
    const incDx = locationX - lastTouchX.current;
    const incDy = locationY - lastTouchY.current;
    lastTouchX.current = locationX;
    lastTouchY.current = locationY;

    // 2. 3D orbit and walkthrough camera controllers
    if (viewMode === "3d") {
      // Orbit drag rotation: Horizontal rotation (Yaw) only, vertical rotation (Pitch) locked for CAD stability
      setOrbitYaw(prev => {
        const next = (prev + incDx * 0.5) % 360;
        return next < 0 ? next + 360 : next;
      });
      return;
    }

    if (viewMode === "walkthrough") {
      // Split Touch screen drag: Left = Walk, Right = Look Gaze
      const splitLimit = windowWidth / 2;
      if (touchStartX < splitLimit) {
        // Move camera position (Forward/Backward/Strafe)
        const moveSpeed = 0.08;
        const rad = (walkYaw * Math.PI) / 180;
        
        // incDy controls forward/backward (Z direction in camera coords)
        const forwardX = moveSpeed * incDy * Math.sin(rad);
        const forwardY = -moveSpeed * incDy * Math.cos(rad);
        // incDx controls left/right strafe
        const strafeX = moveSpeed * incDx * Math.cos(rad);
        const strafeY = moveSpeed * incDx * Math.sin(rad);

        setCamX(prev => prev + forwardX + strafeX);
        setCamY(prev => prev + forwardY + strafeY);
      } else {
        // Look look-up/down yaw and pitch
        setWalkYaw(prev => {
          const next = (prev + incDx * 0.5) % 360;
          return next < 0 ? next + 360 : next;
        });
        setWalkPitch(prev => Math.max(-45, Math.min(45, prev - incDy * 0.5)));
      }
      return;
    }

    const dx = locationX - touchStartX;
    const dy = locationY - touchStartY;

    // 2D panning logic
    if (viewMode === "2d" && isPanning2D) {
      setPan2D({
        x: panStart.x + dx,
        y: panStart.y + dy
      });
      return;
    }

    // Compute canvas coordinates for 2D calculations
    const calcX = (locationX - pan2D.x) / zoom2D;
    const calcY = (locationY - pan2D.y) / zoom2D;

    // 3. 2D editing and drawing movement drag
    if (tool === "draw_wall" && drawingWall) {
      const snapTarget = getNearestEndpoint(calcX, calcY);
      const snapX = snapTarget ? snapTarget.x : snap(calcX);
      const snapY = snapTarget ? snapTarget.y : snap(calcY);
      
      setDrawingWall({ ...drawingWall, x2: snapX, y2: snapY });
      setSnapIndicator(snapTarget);
      return;
    }

    if (!draggedItem) return;

    if (draggedItem.type === "room") {
      const room = rooms.find(r => r.id === draggedItem.id);
      if (!room) return;

      if (draggedItem.handle === "right") {
        const newW = Math.max(16, snap(calcX - room.x));
        setRooms(rooms.map(r => r.id === room.id ? { ...r, width: newW } : r));
      } else if (draggedItem.handle === "left") {
        const newW = Math.max(16, snap(room.x + room.width - calcX));
        const newX = snap(calcX);
        if (newW >= 16) {
          setRooms(rooms.map(r => r.id === room.id ? { ...r, x: newX, width: newW } : r));
        }
      } else if (draggedItem.handle === "bottom") {
        const newH = Math.max(16, snap(calcY - room.y));
        setRooms(rooms.map(r => r.id === room.id ? { ...r, height: newH } : r));
      } else if (draggedItem.handle === "top") {
        const newH = Math.max(16, snap(room.y + room.height - calcY));
        const newY = snap(calcY);
        if (newH >= 16) {
          setRooms(rooms.map(r => r.id === room.id ? { ...r, y: newY, height: newH } : r));
        }
      } else if (draggedItem.handle === "move") {
        const newX = snap(calcX - (draggedItem.offsetX || 0));
        const newY = snap(calcY - (draggedItem.offsetY || 0));

        // Lego-Style Snap edge detection (15px snap radius)
        let snappedX = newX;
        let snappedY = newY;
        const SNAP_LIMIT = 15;

        for (const other of rooms) {
          if (other.id === room.id) continue;
          
          // X snap
          if (Math.abs(newX - other.x) < SNAP_LIMIT) {
            snappedX = other.x;
          } else if (Math.abs((newX + room.width) - (other.x + other.width)) < SNAP_LIMIT) {
            snappedX = other.x + other.width - room.width;
          } else if (Math.abs(newX - (other.x + other.width)) < SNAP_LIMIT) {
            snappedX = other.x + other.width;
          } else if (Math.abs((newX + room.width) - other.x) < SNAP_LIMIT) {
            snappedX = other.x - room.width;
          }

          // Y snap
          if (Math.abs(newY - other.y) < SNAP_LIMIT) {
            snappedY = other.y;
          } else if (Math.abs((newY + room.height) - (other.y + other.height)) < SNAP_LIMIT) {
            snappedY = other.y + other.height - room.height;
          } else if (Math.abs(newY - (other.y + other.height)) < SNAP_LIMIT) {
            snappedY = other.y + other.height;
          } else if (Math.abs((newY + room.height) - other.y) < SNAP_LIMIT) {
            snappedY = other.y - room.height;
          }
        }

        setRooms(rooms.map(r => r.id === room.id ? { ...r, x: snappedX, y: snappedY } : r));
        
        // Move child items along
        if (draggedItem.childFurniture) {
          setFurniture(prev => prev.map(f => {
            const match = draggedItem.childFurniture?.find(c => c.id === f.id);
            return match ? { ...f, x: snappedX + match.relativeX, y: snappedY + match.relativeY } : f;
          }));
        }
        if (draggedItem.childOpenings) {
          setOpenings(prev => prev.map(op => {
            const match = draggedItem.childOpenings?.find(c => c.id === op.id);
            return match ? { ...op, x: snappedX + match.relativeX, y: snappedY + match.relativeY } : op;
          }));
        }
      }
    } else if (draggedItem.type === "furniture") {
      const furn = furniture.find(f => f.id === draggedItem.id);
      if (!furn) return;
      const newX = snap(calcX - (draggedItem.offsetX || 0));
      const newY = snap(calcY - (draggedItem.offsetY || 0));
      setFurniture(furniture.map(f => f.id === furn.id ? { ...f, x: newX, y: newY } : f));
    } else if (draggedItem.type === "opening") {
      const op = openings.find(o => o.id === draggedItem.id);
      if (!op) return;
      const snapResult = snapOpeningToWalls(calcX, calcY);
      setOpenings(openings.map(o => o.id === op.id ? { ...o, x: snapResult.x, y: snapResult.y, rotation: snapResult.rotation } : o));
    }
  };

  const handleTouchEnd = () => {
    setDraggedItem(null);
    setPinchDist(0);
    setSnapIndicator(null);
    setIsPanning2D(false);

    // Save drawn wall segment to list
    if (tool === "draw_wall" && drawingWall) {
      const dx = drawingWall.x2 - drawingWall.x1;
      const dy = drawingWall.y2 - drawingWall.y1;
      const length = Math.sqrt(dx * dx + dy * dy) / PIXELS_PER_FOOT;

      if (length >= 1.5) { // Only save walls longer than 1.5 ft
        const id = "wall_" + Date.now();
        const newWall: CustomWall = {
          id,
          x1: drawingWall.x1,
          y1: drawingWall.y1,
          x2: drawingWall.x2,
          y2: drawingWall.y2,
          thickness: 0.5, // 6 inches standard thickness
        };
        setCustomWalls([...customWalls, newWall]);
        setSelectedItem({ type: "wall", id });
      }
      setDrawingWall(null);
    }
  };

  // Update opening slider coordinates
  const updateOpeningPosition = (id: string, x: number, y: number) => {
    setOpenings(prev => prev.map(o => o.id === id ? { ...o, x, y } : o));
  };

  // Area calculation math
  const getRoomArea = (room: Room) => {
    return Math.round((room.width / PIXELS_PER_FOOT) * (room.height / PIXELS_PER_FOOT));
  };

  const getTotalArea = () => {
    return rooms.reduce((sum, r) => sum + getRoomArea(r), 0);
  };

  // Pre-load AutoCAD blueprints
  const loadPresetTemplate = (type: "1bhk" | "2bhk" | "studio") => {
    setSelectedItem(null);
    let newRooms: Room[] = [];
    let newOpenings: Opening[] = [];
    let newFurniture: Furniture[] = [];

    if (type === "studio") {
      newRooms = [
        { id: "r1", label: "Studio Hall", x: 40, y: 60, width: 80, height: 100, color: "#FFFFFF05" },
        { id: "r2", label: "Bathroom", x: 120, y: 60, width: 40, height: 50, color: "#FFFFFF05" },
        { id: "r3", label: "Kitchen", x: 120, y: 110, width: 40, height: 50, color: "#FFFFFF05" },
      ];
      newOpenings = [
        { id: "o1", type: "door", x: 40, y: 110, width: 12, rotation: 90 },
        { id: "o2", type: "door", x: 120, y: 85, width: 12, rotation: 90 },
        { id: "o3", type: "door", x: 120, y: 135, width: 12, rotation: 90 },
        { id: "o4", type: "window", x: 80, y: 60, width: 16, rotation: 0 },
        { id: "o5", type: "window", x: 160, y: 135, width: 16, rotation: 90 },
      ];
      newFurniture = [
        { id: "f1", type: "bed", x: 50, y: 70, width: 20, height: 26, rotation: 0 },
        { id: "f2", type: "sofa", x: 90, y: 120, width: 24, height: 12, rotation: 180 },
      ];
    } else if (type === "1bhk") {
      newRooms = [
        { id: "r1", label: "Living Room", x: 40, y: 40, width: 64, height: 80, color: "#FFFFFF05" },
        { id: "r2", label: "Master Bed", x: 104, y: 40, width: 56, height: 64, color: "#FFFFFF05" },
        { id: "r3", label: "Kitchen", x: 104, y: 104, width: 56, height: 56, color: "#FFFFFF05" },
        { id: "r4", label: "Bathroom", x: 40, y: 120, width: 64, height: 40, color: "#FFFFFF05" },
      ];
      newOpenings = [
        { id: "o1", type: "door", x: 40, y: 70, width: 12, rotation: 270 },
        { id: "o2", type: "door", x: 104, y: 56, width: 12, rotation: 270 },
        { id: "o3", type: "door", x: 104, y: 118, width: 12, rotation: 270 },
        { id: "o4", type: "door", x: 64, y: 120, width: 12, rotation: 0 },
        { id: "o5", type: "window", x: 72, y: 40, width: 16, rotation: 0 },
        { id: "o6", type: "window", x: 132, y: 40, width: 16, rotation: 0 },
        { id: "o7", type: "window", x: 160, y: 132, width: 16, rotation: 90 },
        { id: "o8", type: "window", x: 40, y: 140, width: 16, rotation: 270 },
      ];
      newFurniture = [
        { id: "f1", type: "bed", x: 132, y: 70, width: 20, height: 26, rotation: 0 },
        { id: "f2", type: "sofa", x: 55, y: 45, width: 24, height: 12, rotation: 0 },
        { id: "f3", type: "toilet", x: 90, y: 145, width: 8, height: 10, rotation: 90 },
      ];
    } else if (type === "2bhk") {
      newRooms = [
        { id: "r1", label: "Living Room", x: 40, y: 40, width: 60, height: 80, color: "#FFFFFF05" },
        { id: "r2", label: "Kitchen", x: 100, y: 40, width: 60, height: 48, color: "#FFFFFF05" },
        { id: "r3", label: "Bathroom", x: 100, y: 88, width: 60, height: 32, color: "#FFFFFF05" },
        { id: "r4", label: "Master Bed", x: 40, y: 120, width: 60, height: 80, color: "#FFFFFF05" },
        { id: "r5", label: "Kids Bed", x: 100, y: 120, width: 60, height: 80, color: "#FFFFFF05" },
      ];
      newOpenings = [
        { id: "o1", type: "door", x: 40, y: 80, width: 12, rotation: 270 },
        { id: "o2", type: "door", x: 70, y: 120, width: 12, rotation: 0 },
        { id: "o3", type: "door", x: 130, y: 120, width: 12, rotation: 0 },
        { id: "o4", type: "door", x: 100, y: 70, width: 12, rotation: 270 },
        { id: "o5", type: "door", x: 100, y: 104, width: 12, rotation: 270 },
        { id: "o6", type: "window", x: 70, y: 40, width: 16, rotation: 0 },
        { id: "o7", type: "window", x: 130, y: 40, width: 16, rotation: 0 },
        { id: "o8", type: "window", x: 70, y: 200, width: 16, rotation: 180 },
        { id: "o9", type: "window", x: 130, y: 200, width: 16, rotation: 180 },
      ];
      newFurniture = [
        { id: "f1", type: "bed", x: 45, y: 160, width: 20, height: 26, rotation: 0 },
        { id: "f2", type: "bed", x: 130, y: 160, width: 20, height: 26, rotation: 0 },
        { id: "f3", type: "sofa", x: 55, y: 45, width: 24, height: 12, rotation: 0 },
        { id: "f4", type: "table", x: 60, y: 80, width: 16, height: 12, rotation: 0 },
        { id: "f5", type: "toilet", x: 145, y: 92, width: 8, height: 10, rotation: 90 },
      ];
    }

    setRooms(newRooms);
    setOpenings(newOpenings);
    setFurniture(newFurniture);
    setCustomWalls([]);

    setTimeout(() => {
      centerPlan2D(newRooms, []);
    }, 100);
  };

  // Mouse Web Simulation Wrapper
  const handleMouseDown = (e: any) => {
    if (Platform.OS !== "web") return;
    const rect = e.currentTarget.getBoundingClientRect ? e.currentTarget.getBoundingClientRect() : { left: 0, top: 0 };
    const locationX = e.clientX - rect.left;
    const locationY = e.clientY - rect.top;
    
    setIsMouseDown(true);
    handleTouchStart({
      nativeEvent: {
        locationX,
        locationY,
        touches: []
      }
    });
  };

  const handleMouseMove = (e: any) => {
    if (Platform.OS !== "web" || !isMouseDown) return;
    const rect = e.currentTarget.getBoundingClientRect ? e.currentTarget.getBoundingClientRect() : { left: 0, top: 0 };
    const locationX = e.clientX - rect.left;
    const locationY = e.clientY - rect.top;

    handleTouchMove({
      nativeEvent: {
        locationX,
        locationY,
        touches: []
      }
    });
  };

  const handleMouseUp = (e: any) => {
    if (Platform.OS !== "web") return;
    setIsMouseDown(false);
    handleTouchEnd();
  };

  const handleMouseLeave = (e: any) => {
    if (Platform.OS !== "web") return;
    setIsMouseDown(false);
    handleTouchEnd();
  };

  const handleWheel = (e: any) => {
    if (Platform.OS !== "web") return;
    // zoom factor
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    if (viewMode === "2d") {
      setZoom2D(prev => Math.max(0.1, Math.min(5.0, prev * zoomFactor)));
    } else if (viewMode === "3d") {
      setZoomScale(prev => Math.max(0.1, Math.min(3.0, prev * zoomFactor)));
    }
  };

  const handleZoomIn = () => {
    if (viewMode === "2d") {
      setZoom2D((prev) => Math.min(5.0, prev * 1.2));
    } else if (viewMode === "3d") {
      setZoomScale((prev) => Math.min(3.0, prev * 1.2));
    }
  };

  const handleZoomOut = () => {
    if (viewMode === "2d") {
      setZoom2D((prev) => Math.max(0.1, prev / 1.2));
    } else if (viewMode === "3d") {
      setZoomScale((prev) => Math.max(0.1, prev / 1.2));
    }
  };

  const handleResetView = () => {
    if (viewMode === "2d") {
      setZoom2D(1.0);
      centerPlan2D();
    } else if (viewMode === "3d") {
      setZoomScale(0.8);
      setOrbitYaw(45);
      setOrbitPitch(35);
    } else if (viewMode === "walkthrough") {
      setCamX(20);
      setCamY(20);
      setCamZ(5.0);
      setWalkYaw(0);
      setWalkPitch(0);
    }
  };

  const setCameraPreset = (preset: "iso" | "top" | "front" | "side") => {
    if (preset === "iso") {
      setOrbitYaw(45);
      setOrbitPitch(35);
    } else if (preset === "top") {
      setOrbitYaw(270);
      setOrbitPitch(85);
    } else if (preset === "front") {
      setOrbitYaw(270);
      setOrbitPitch(15);
    } else if (preset === "side") {
      setOrbitYaw(180);
      setOrbitPitch(15);
    }
  };

  // 3D Camera Projection Mathematics (Yaw, Pitch, Translation, FOV)
  const projectPoint3D = (x: number, y: number, z: number) => {
    // Current camera parameters based on viewMode
    let activeCamX = camX;
    let activeCamY = camY;
    let activeCamZ = camZ;
    let fx = 0, fy = 0, fz = 0;

    const FOV = 280;
    const isOrtho = projectionMode === "orthographic" && viewMode === "3d";

    if (viewMode === "3d") {
      // Orbit camera on a sphere around the layout center
      const center = getLayoutCenter();
      // For orthographic, distance (radius) doesn't change perspective scale, so keep it constant
      const radius = isOrtho ? 55 : (55 / zoomScale);
      const yawRad = (orbitYaw * Math.PI) / 180;
      const pitchRad = (orbitPitch * Math.PI) / 180;

      activeCamX = center.x + radius * Math.cos(yawRad) * Math.cos(pitchRad);
      activeCamY = center.y + radius * Math.sin(yawRad) * Math.cos(pitchRad);
      activeCamZ = 4.5 + radius * Math.sin(pitchRad);

      // Forward look vector pointing from Camera to Target Center
      const dxLook = center.x - activeCamX;
      const dyLook = center.y - activeCamY;
      const dzLook = 4.5 - activeCamZ;
      const lenLook = Math.sqrt(dxLook * dxLook + dyLook * dyLook + dzLook * dzLook);
      if (lenLook > 0.0001) {
        fx = dxLook / lenLook;
        fy = dyLook / lenLook;
        fz = dzLook / lenLook;
      } else {
        fx = 0;
        fy = -1;
        fz = 0;
      }
    } else {
      // Walkthrough mode: forward gaze vector based on walkYaw and walkPitch
      const yawRad = (walkYaw * Math.PI) / 180;
      const pitchRad = (walkPitch * Math.PI) / 180;
      fx = Math.sin(yawRad) * Math.cos(pitchRad);
      fy = -Math.cos(yawRad) * Math.cos(pitchRad);
      fz = Math.sin(pitchRad);
    }

    // Camera LookAt coordinate system derivation:
    // Right Vector R = F x U (where U = (0, 0, 1) is world up)
    // This mathematically guarantees zero roll (horizon is always perfectly horizontal, no tilting)
    let rx = fy;
    let ry = -fx;
    let lenR = Math.sqrt(rx * rx + ry * ry);
    if (lenR < 0.0001) {
      // Fallback looking straight up/down to prevent division by zero
      rx = 1;
      ry = 0;
      lenR = 1;
    } else {
      rx = rx / lenR;
      ry = ry / lenR;
    }

    // Up Vector V = R x F
    const vx = ry * fz;
    const vy = -rx * fz;
    const vz = rx * fy - ry * fx;

    // Translate point relative to camera
    const dx = x - activeCamX;
    const dy = y - activeCamY;
    const dz = z - activeCamZ;

    // Transform point to camera space
    const camXCoord = dx * rx + dy * ry;
    const camYCoord = dx * vx + dy * vy + dz * vz;
    const depth = dx * fx + dy * fy + dz * fz;

    if (isOrtho) {
      // Orthographic projection: parallel projection without perspective depth division
      const orthoScale = 12 * zoomScale;
      return {
        x: camXCoord * orthoScale + windowWidth / 2,
        y: viewportHeight / 2 - camYCoord * orthoScale, // Flipped Y to map physical UP to SVG top (smaller Y)
        depth, // still return depth for painter's algorithm sorting
      };
    }

    return {
      x: depth > 0.1 ? (camXCoord / depth) * FOV + windowWidth / 2 : -9999,
      y: depth > 0.1 ? viewportHeight / 2 - (camYCoord / depth) * FOV : -9999, // Flipped Y to map physical UP to SVG top (smaller Y)
      depth,
    };
  };

  const getLayoutCenter = () => {
    if (rooms.length === 0 && customWalls.length === 0) return { x: 20, y: 20 };
    let minX = 9999, maxX = -9999, minY = 9999, maxY = -9999;
    
    rooms.forEach(r => {
      const rx = r.x / 4;
      const ry = r.y / 4;
      const rw = r.width / 4;
      const rh = r.height / 4;
      minX = Math.min(minX, rx);
      maxX = Math.max(maxX, rx + rw);
      minY = Math.min(minY, ry);
      maxY = Math.max(maxY, ry + rh);
    });

    customWalls.forEach(w => {
      const wx1 = w.x1 / 4;
      const wy1 = w.y1 / 4;
      const wx2 = w.x2 / 4;
      const wy2 = w.y2 / 4;
      minX = Math.min(minX, wx1, wx2);
      maxX = Math.max(maxX, wx1, wx2);
      minY = Math.min(minY, wy1, wy2);
      maxY = Math.max(maxY, wy1, wy2);
    });

    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  };

  // Rendering engine: 3D walls, slabs, doors, and furniture
  const render3DLayout = () => {
    const renderQueue: { depth: number; key: string; element: React.ReactNode }[] = [];

    // 0. Ground Plane and AutoCAD-Style Grid
    const center = getLayoutCenter();
    const groundSize = 120; // 120 ft radius ground plane
    const gridSpacing = 10; // reference line every 10 ft

    const gA = projectPoint3D(center.x - groundSize, center.y - groundSize, -0.05);
    const gB = projectPoint3D(center.x + groundSize, center.y - groundSize, -0.05);
    const gC = projectPoint3D(center.x + groundSize, center.y + groundSize, -0.05);
    const gD = projectPoint3D(center.x - groundSize, center.y + groundSize, -0.05);

    if (gA.x !== -9999 && gB.x !== -9999 && gC.x !== -9999 && gD.x !== -9999) {
      const avgDepth = (gA.depth + gB.depth + gC.depth + gD.depth) / 4 + 100;
      renderQueue.push({
        depth: avgDepth,
        key: "ground_plane",
        element: (
          <Path
            d={`M ${gA.x} ${gA.y} L ${gB.x} ${gB.y} L ${gC.x} ${gC.y} L ${gD.x} ${gD.y} Z`}
            fill="#15181C" // Subtle dark blueprint charcoal ground
            stroke="#272D35"
            strokeWidth={0.5}
          />
        ),
      });
    }

    // Grid lines parallel to Y-axis
    for (let xOffset = -groundSize; xOffset <= groundSize; xOffset += gridSpacing) {
      const p1 = projectPoint3D(center.x + xOffset, center.y - groundSize, -0.05);
      const p2 = projectPoint3D(center.x + xOffset, center.y + groundSize, -0.05);
      if (p1.x !== -9999 && p2.x !== -9999) {
        const avgDepth = (p1.depth + p2.depth) / 2 + 90;
        renderQueue.push({
          depth: avgDepth,
          key: `grid_x_${xOffset}`,
          element: (
            <Line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={xOffset === 0 ? "rgba(0, 245, 212, 0.25)" : "rgba(71, 85, 105, 0.15)"} // Highlight center cyan axis
              strokeWidth={xOffset === 0 ? 1.2 : 0.6}
            />
          ),
        });
      }
    }

    // Grid lines parallel to X-axis
    for (let yOffset = -groundSize; yOffset <= groundSize; yOffset += gridSpacing) {
      const p1 = projectPoint3D(center.x - groundSize, center.y + yOffset, -0.05);
      const p2 = projectPoint3D(center.x + groundSize, center.y + yOffset, -0.05);
      if (p1.x !== -9999 && p2.x !== -9999) {
        const avgDepth = (p1.depth + p2.depth) / 2 + 90;
        renderQueue.push({
          depth: avgDepth,
          key: `grid_y_${yOffset}`,
          element: (
            <Line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={yOffset === 0 ? "rgba(0, 245, 212, 0.25)" : "rgba(71, 85, 105, 0.15)"}
              strokeWidth={yOffset === 0 ? 1.2 : 0.6}
            />
          ),
        });
      }
    }

    // 1. Draw floor slabs
    rooms.forEach((room) => {
      const rx = room.x / 4;
      const ry = room.y / 4;
      const rw = room.width / 4;
      const rh = room.height / 4;

      const pA = projectPoint3D(rx, ry, 0);
      const pB = projectPoint3D(rx + rw, ry, 0);
      const pC = projectPoint3D(rx + rw, ry + rh, 0);
      const pD = projectPoint3D(rx, ry + rh, 0);

      // Verify points project on screen
      if (pA.x !== -9999 && pB.x !== -9999 && pC.x !== -9999 && pD.x !== -9999) {
        const avgDepth = (pA.depth + pB.depth + pC.depth + pD.depth) / 4;
        renderQueue.push({
          depth: avgDepth,
          key: `slab_${room.id}`,
          element: (
            <Path
              d={`M ${pA.x} ${pA.y} L ${pB.x} ${pB.y} L ${pC.x} ${pC.y} L ${pD.x} ${pD.y} Z`}
              fill="#2A2E33" // Slate Floor Slab
              stroke="#434952"
              strokeWidth={0.5}
            />
          ),
        });
      }
    });

    // 2. Extrude walls (9' height Ground Floor default)
    const compiledWalls = getCompilationWalls();
    compiledWalls.forEach((w, index) => {
      const wx1 = w.x1 / 4;
      const wy1 = w.y1 / 4;
      const wx2 = w.x2 / 4;
      const wy2 = w.y2 / 4;
      const wallH = 9.0; // Default height 9 ft

      const pBA = projectPoint3D(wx1, wy1, 0);
      const pBB = projectPoint3D(wx2, wy2, 0);
      const pTA = projectPoint3D(wx1, wy1, wallH);
      const pTB = projectPoint3D(wx2, wy2, wallH);

      if (pBA.x !== -9999 && pBB.x !== -9999 && pTA.x !== -9999 && pTB.x !== -9999) {
        const avgDepth = (pBA.depth + pBB.depth + pTA.depth + pTB.depth) / 4;
        
        // AutoCAD diffuse shading calculations based on wall segment angle
        const angle = Math.atan2(wy2 - wy1, wx2 - wx1);
        const intensity = Math.floor(140 + Math.sin(angle) * 35);
        const color = `rgb(${intensity}, ${intensity + 5}, ${intensity + 12})`;

        renderQueue.push({
          depth: avgDepth,
          key: `wall_${w.id}_${index}`,
          element: (
            <Path
              d={`M ${pBA.x} ${pBA.y} L ${pBB.x} ${pBB.y} L ${pTB.x} ${pTB.y} L ${pTA.x} ${pTA.y} Z`}
              fill={color}
              stroke="#5E6773"
              strokeWidth={0.8}
            />
          ),
        });
      }
    });

    // 3. Openings (Windows and Doors)
    openings.forEach((op) => {
      const opX = op.x / 4;
      const opY = op.y / 4;
      const w = op.width / 4;
      const rad = (op.rotation * Math.PI) / 180;
      
      const x1 = opX - (w / 2) * Math.cos(rad);
      const y1 = opY - (w / 2) * Math.sin(rad);
      const x2 = opX + (w / 2) * Math.cos(rad);
      const y2 = opY + (w / 2) * Math.sin(rad);

      const zMin = op.type === "door" ? 0 : 3.0; // sill height for window
      const zMax = op.type === "door" ? 7.0 : 6.5; // height 7 ft for door, 3.5 ft for window

      const p1 = projectPoint3D(x1, y1, zMin);
      const p2 = projectPoint3D(x2, y2, zMin);
      const p3 = projectPoint3D(x2, y2, zMax);
      const p4 = projectPoint3D(x1, y1, zMax);

      if (p1.x !== -9999 && p2.x !== -9999 && p3.x !== -9999 && p4.x !== -9999) {
        const avgDepth = (p1.depth + p2.depth + p3.depth + p4.depth) / 4;
        const color = op.type === "door" ? "#8A5A36" : "rgba(56, 189, 248, 0.45)"; // Blue glass for window
        const strokeColor = op.type === "door" ? "#D9A443" : "#3B82F6";

        renderQueue.push({
          depth: avgDepth,
          key: `op_3d_${op.id}`,
          element: (
            <Path
              d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z`}
              fill={color}
              stroke={strokeColor}
              strokeWidth={1}
            />
          ),
        });
      }
    });

    // 4. Furniture blocks
    furniture.forEach((f) => {
      const fx = f.x / 4;
      const fy = f.y / 4;
      const fw = f.width / 4;
      const fh = f.height / 4;
      const fHeight = f.type === "bed" ? 1.8 : f.type === "sofa" ? 2.5 : 2.5;

      // Rotate furniture box vertices
      const rad = (f.rotation * Math.PI) / 180;
      const halfW = fw / 2;
      const halfH = fh / 2;
      const cx = fx + halfW;
      const cy = fy + halfH;

      const corners = [
        { dx: -halfW, dy: -halfH },
        { dx: halfW, dy: -halfH },
        { dx: halfW, dy: halfH },
        { dx: -halfW, dy: halfH },
      ].map(offset => {
        const rx = offset.dx * Math.cos(rad) - offset.dy * Math.sin(rad) + cx;
        const ry = offset.dx * Math.sin(rad) + offset.dy * Math.cos(rad) + cy;
        return { x: rx, y: ry };
      });

      // Project top and bottom corners
      const pBottom = corners.map(c => projectPoint3D(c.x, c.y, 0));
      const pTop = corners.map(c => projectPoint3D(c.x, c.y, fHeight));

      if (pBottom.every(p => p.x !== -9999) && pTop.every(p => p.x !== -9999)) {
        const avgDepth = pBottom.reduce((sum, p) => sum + p.depth, 0) / 4;

        renderQueue.push({
          depth: avgDepth,
          key: `furn_3d_${f.id}`,
          element: (
            <G>
              {/* Top Face */}
              <Path
                d={`M ${pTop[0].x} ${pTop[0].y} L ${pTop[1].x} ${pTop[1].y} L ${pTop[2].x} ${pTop[2].y} L ${pTop[3].x} ${pTop[3].y} Z`}
                fill="#4E5660"
                stroke="#6B7785"
                strokeWidth={0.8}
              />
              {/* Front Facings */}
              <Path
                d={`M ${pBottom[0].x} ${pBottom[0].y} L ${pBottom[1].x} ${pBottom[1].y} L ${pTop[1].x} ${pTop[1].y} L ${pTop[0].x} ${pTop[0].y} Z`}
                fill="#3C434C"
                stroke="#6B7785"
                strokeWidth={0.8}
              />
              <Path
                d={`M ${pBottom[1].x} ${pBottom[1].y} L ${pBottom[2].x} ${pBottom[2].y} L ${pTop[2].x} ${pTop[2].y} L ${pTop[1].x} ${pTop[1].y} Z`}
                fill="#2E333A"
                stroke="#6B7785"
                strokeWidth={0.8}
              />
            </G>
          ),
        });
      }
    });

    // Sort from back to front (Painter's algorithm)
    renderQueue.sort((a, b) => b.depth - a.depth);
    return renderQueue.map(item => item.element);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* CAD File title bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <TextInput
          style={styles.projectInput}
          value={projectName}
          onChangeText={setProjectName}
          placeholder="CAD Layout Title"
          placeholderTextColor="#64748B"
        />
        <TouchableOpacity style={styles.clearBtn} onPress={clearCanvas}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {/* Mode selectors */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tabBtn, viewMode === "2d" && styles.tabActive]} onPress={() => { setViewMode("2d"); setTool("select"); }}>
          <Ionicons name="map-outline" size={16} color={viewMode === "2d" ? COLORS.cadSelect : COLORS.slate} />
          <Text style={[styles.tabText, viewMode === "2d" && styles.tabTextActive]}>2D Blueprint</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tabBtn, viewMode === "3d" && styles.tabActive]} onPress={() => setViewMode("3d")}>
          <Ionicons name="cube-outline" size={16} color={viewMode === "3d" ? COLORS.cadSelect : COLORS.slate} />
          <Text style={[styles.tabText, viewMode === "3d" && styles.tabTextActive]}>3D Orbit</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tabBtn, viewMode === "walkthrough" && styles.tabActive]} onPress={() => { setViewMode("walkthrough"); setCamX(20); setCamY(20); }}>
          <Ionicons name="walk-outline" size={16} color={viewMode === "walkthrough" ? COLORS.cadSelect : COLORS.slate} />
          <Text style={[styles.tabText, viewMode === "walkthrough" && styles.tabTextActive]}>Walkthrough</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tabBtn, viewMode === "presets" && styles.tabActive]} onPress={() => setViewMode("presets")}>
          <Ionicons name="file-tray-full-outline" size={16} color={viewMode === "presets" ? COLORS.cadSelect : COLORS.slate} />
          <Text style={[styles.tabText, viewMode === "presets" && styles.tabTextActive]}>Templates</Text>
        </TouchableOpacity>
      </View>

      {/* 2D CANVAS / 3D VIEWPORT CONTAINER */}
      <View
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        {...({
          onMouseDown: handleMouseDown,
          onMouseMove: handleMouseMove,
          onMouseUp: handleMouseUp,
          onMouseLeave: handleMouseLeave,
          onWheel: handleWheel,
        } as any)}
        style={[styles.viewport, { height: viewportHeight }]}
      >
        {viewMode === "2d" && (
          <Svg width={windowWidth} height={viewportHeight} style={{ backgroundColor: COLORS.cadBg }}>
            <Defs>
              <Pattern id="cadGrid" width={16} height={16} patternUnits="userSpaceOnUse">
                <Path d="M 16 0 L 0 0 0 16" fill="none" stroke={COLORS.cadGrid} strokeWidth="1" />
              </Pattern>
            </Defs>
            
            <G transform={`translate(${pan2D.x}, ${pan2D.y}) scale(${zoom2D})`}>
              {/* Draw Grid Background */}
              <Rect x={-5000} y={-5000} width={10000} height={10000} fill="url(#cadGrid)" />

              {/* 1. Floor Slabs */}
              {rooms.map((room) => {
                const isSelected = selectedItem?.type === "room" && selectedItem?.id === room.id;
                const rWidthFt = room.width / PIXELS_PER_FOOT;
                const rHeightFt = room.height / PIXELS_PER_FOOT;

                return (
                  <G key={room.id}>
                    <Rect
                      x={room.x}
                      y={room.y}
                      width={room.width}
                      height={room.height}
                      fill={isSelected ? "rgba(255, 159, 28, 0.05)" : "transparent"}
                      stroke={isSelected ? COLORS.cadSelect : COLORS.cadWallBorder}
                      strokeWidth={isSelected ? 3.5 : 2.5}
                    />
                    {/* Room Label & Area Callout */}
                    <SvgText x={room.x + room.width / 2} y={room.y + room.height / 2 - 4 / zoom2D} textAnchor="middle" fontSize={Math.max(8, 11 / zoom2D)} fontWeight="bold" fill="#ECEFF1">
                      {room.label}
                    </SvgText>
                    <SvgText x={room.x + room.width / 2} y={room.y + room.height / 2 + 10 / zoom2D} textAnchor="middle" fontSize={Math.max(6, 9 / zoom2D)} fill={COLORS.cadDimension}>
                      {rWidthFt}' x {rHeightFt}' ({getRoomArea(room)} sqft)
                    </SvgText>

                    {/* Wall resizing knobs */}
                    {isSelected && (
                      <G>
                        <Circle cx={room.x + room.width} cy={room.y + room.height / 2} r={7 / zoom2D} fill={COLORS.cadSelect} />
                        <Circle cx={room.x} cy={room.y + room.height / 2} r={7 / zoom2D} fill={COLORS.cadSelect} />
                        <Circle cx={room.x + room.width / 2} cy={room.y + room.height} r={7 / zoom2D} fill={COLORS.cadSelect} />
                        <Circle cx={room.x + room.width / 2} cy={room.y} r={7 / zoom2D} fill={COLORS.cadSelect} />
                      </G>
                    )}
                  </G>
                );
              })}

              {/* 2. Custom Drawn Walls */}
              {customWalls.map((w) => {
                const isSelected = selectedItem?.type === "wall" && selectedItem?.id === w.id;
                const dx = w.x2 - w.x1;
                const dy = w.y2 - w.y1;
                const lengthFt = (Math.sqrt(dx * dx + dy * dy) / PIXELS_PER_FOOT).toFixed(1);
                
                // Angle for writing text parallel to wall segment
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                const midX = (w.x1 + w.x2) / 2;
                const midY = (w.y1 + w.y2) / 2;

                return (
                  <G key={w.id}>
                    {/* AutoCAD Wall joins: strokeLinecap="round" resolves wall corners beautifully */}
                    <Line
                      x1={w.x1}
                      y1={w.y1}
                      x2={w.x2}
                      y2={w.y2}
                      stroke={isSelected ? COLORS.cadSelect : COLORS.cadWall}
                      strokeWidth={isSelected ? 3.5 : 2.5}
                      strokeLinecap="round"
                    />
                    {/* Dimension Text overlay */}
                    <G transform={`translate(${midX}, ${midY - 8 / zoom2D}) rotate(${angle}, 0, 0)`}>
                      <SvgText textAnchor="middle" fontSize={Math.max(6, 9 / zoom2D)} fontWeight="bold" fill={COLORS.cadDimension}>
                        {lengthFt}' ft
                      </SvgText>
                    </G>
                  </G>
                );
              })}

              {/* 3. Snapped Windows and Doors */}
              {openings.map((op) => {
                const isSelected = selectedItem?.type === "opening" && selectedItem?.id === op.id;
                return (
                  <G key={op.id} transform={`rotate(${op.rotation}, ${op.x}, ${op.y})`}>
                    {op.type === "door" ? (
                      <G>
                        <Path d={`M ${op.x} ${op.y + op.width} A ${op.width} ${op.width} 0 0 0 ${op.x + op.width} ${op.y}`} fill="none" stroke={COLORS.cadDoor} strokeWidth={0.8} strokeDasharray="2,2" />
                        <Line x1={op.x} y1={op.y} x2={op.x} y2={op.y + op.width} stroke={isSelected ? COLORS.cadSelect : COLORS.cadDoor} strokeWidth={1.5} />
                        <Circle cx={op.x} cy={op.y} r={1.5} fill={COLORS.cadDoor} />
                      </G>
                    ) : (
                      <Rect x={op.x - op.width / 2} y={op.y - 1.2} width={op.width} height={2.4} fill="#1E293B" stroke={isSelected ? COLORS.cadSelect : COLORS.cadWindow} strokeWidth={0.8} />
                    )}
                  </G>
                );
              })}

              {/* 4. Furniture Elements */}
              {furniture.map((f) => {
                const isSelected = selectedItem?.type === "furniture" && selectedItem?.id === f.id;
                return (
                  <G key={f.id} transform={`rotate(${f.rotation}, ${f.x + f.width / 2}, ${f.y + f.height / 2})`}>
                    <Rect x={f.x} y={f.y} width={f.width} height={f.height} rx={2} fill="#27303E" stroke={isSelected ? COLORS.cadSelect : "#5A677C"} strokeWidth={1.2 / zoom2D} />
                    <SvgText x={f.x + f.width / 2} y={f.y + f.height / 2 + (f.height < 12 ? 2 : 3) / zoom2D} textAnchor="middle" fontSize={f.width < 12 ? Math.max(5, 7 / zoom2D) : Math.max(6, 8 / zoom2D)} fill="#94A3B8" fontWeight="bold">
                      {f.type === "toilet" ? "WC" : f.type === "sink" ? "SK" : f.type === "chair" ? "CH" : f.type.toUpperCase()}
                    </SvgText>
                  </G>
                );
              })}

              {/* Live Free Hand Drawing Preview */}
              {tool === "draw_wall" && drawingWall && (
                <G>
                  <Line
                    x1={drawingWall.x1}
                    y1={drawingWall.y1}
                    x2={drawingWall.x2}
                    y2={drawingWall.y2}
                    stroke={COLORS.cadDimension}
                    strokeWidth={2.5}
                    strokeDasharray="4,4"
                    strokeLinecap="round"
                  />
                  {/* Real-time dimension marker label */}
                  <SvgText
                    x={(drawingWall.x1 + drawingWall.x2) / 2}
                    y={(drawingWall.y1 + drawingWall.y2) / 2 - 12 / zoom2D}
                    textAnchor="middle"
                    fontSize={Math.max(7, 10 / zoom2D)}
                    fontWeight="bold"
                    fill={COLORS.cadDimension}
                  >
                    {(Math.sqrt(Math.pow(drawingWall.x2 - drawingWall.x1, 2) + Math.pow(drawingWall.y2 - drawingWall.y1, 2)) / PIXELS_PER_FOOT).toFixed(1)}' ft
                  </SvgText>
                </G>
              )}

              {/* Object snap alignment marker */}
              {snapIndicator && (
                <G>
                  <Rect x={snapIndicator.x - 6 / zoom2D} y={snapIndicator.y - 6 / zoom2D} width={12 / zoom2D} height={12 / zoom2D} fill="none" stroke="#22C55E" strokeWidth={2 / zoom2D} />
                  <Circle cx={snapIndicator.x} cy={snapIndicator.y} r={2 / zoom2D} fill="#22C55E" />
                </G>
              )}
            </G>
          </Svg>
        )}

        {/* 3D ORBIT VIEWPORT (Drag finger to rotate / pinch to zoom) */}
        {viewMode === "3d" && (
          <>
            <Svg width={windowWidth} height={viewportHeight} style={{ backgroundColor: "#0F1215" }}>
              {render3DLayout()}
              
              {/* Viewport indicators */}
              <G transform={`translate(20, ${viewportHeight - 20})`}>
                <SvgText fontSize={9} fill={COLORS.slate} fontWeight="bold">ORBIT: DRAG FINGER/MOUSE TO SPIN</SvgText>
              </G>
            </Svg>

            {/* Camera Presets floating selector */}
            <View style={styles.camPresetContainer}>
              <TouchableOpacity style={styles.camPresetBtn} onPress={() => setCameraPreset("iso")}>
                <Text style={styles.camPresetBtnText}>ISO</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.camPresetBtn} onPress={() => setCameraPreset("top")}>
                <Text style={styles.camPresetBtnText}>TOP</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.camPresetBtn} onPress={() => setCameraPreset("front")}>
                <Text style={styles.camPresetBtnText}>FRONT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.camPresetBtn} onPress={() => setCameraPreset("side")}>
                <Text style={styles.camPresetBtnText}>SIDE</Text>
              </TouchableOpacity>
              <View style={{ width: 1, backgroundColor: "#3D4854", marginVertical: 4 }} />
              <TouchableOpacity 
                style={[styles.camPresetBtn, projectionMode === "orthographic" && { borderColor: COLORS.cadSelect }]} 
                onPress={() => setProjectionMode(prev => prev === "perspective" ? "orthographic" : "perspective")}
              >
                <Text style={[styles.camPresetBtnText, projectionMode === "orthographic" && { color: COLORS.cadSelect }]}>
                  {projectionMode === "orthographic" ? "ORTHO" : "PERSPECT"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Walkthrough view */}
        {viewMode === "walkthrough" && (
          <Svg width={windowWidth} height={viewportHeight} style={{ backgroundColor: "#0F1215" }}>
            {render3DLayout()}

            {/* On-screen virtual joystick HUD indicators */}
            <Line x1={windowWidth / 2} y1={0} x2={windowWidth / 2} y2={viewportHeight} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
            <G transform={`translate(24, 24)`}>
              <SvgText fontSize={9} fill={COLORS.cadDimension} fontWeight="bold">
                CAM POS: {camX.toFixed(1)}', {camY.toFixed(1)}'
              </SvgText>
            </G>
            <G transform={`translate(20, ${viewportHeight - 20})`}>
              <SvgText fontSize={8} fill="rgba(255,255,255,0.25)" fontWeight="bold">LEFT SIDE: DRAG TO WALK</SvgText>
            </G>
            <G transform={`translate(${windowWidth - 120}, ${viewportHeight - 20})`}>
              <SvgText fontSize={8} fill="rgba(255,255,255,0.25)" fontWeight="bold">RIGHT SIDE: DRAG TO LOOK</SvgText>
            </G>
          </Svg>
        )}

        {/* Template selector overlay view */}
        {viewMode === "presets" && (
          <View style={styles.presetsOverlay}>
            <Text style={styles.presetsHeading}>Select AutoCAD Template</Text>
            <TouchableOpacity style={styles.presetCard} onPress={() => loadPresetTemplate("studio")}>
              <Ionicons name="home-outline" size={24} color={COLORS.cadSelect} />
              <View style={styles.presetCardBody}>
                <Text style={styles.presetTitle}>Studio Room Layout (320 sqft)</Text>
                <Text style={styles.presetDesc}>Compact open plan: 20' x 16' including bathroom.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.presetCard} onPress={() => loadPresetTemplate("1bhk")}>
              <Ionicons name="business-outline" size={24} color={COLORS.cadSelect} />
              <View style={styles.presetCardBody}>
                <Text style={styles.presetTitle}>1 BHK Plan (900 sqft)</Text>
                <Text style={styles.presetDesc}>Hall, Bedroom, Kitchen, and Bathroom. 30' x 30' plot footprint.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.presetCard} onPress={() => loadPresetTemplate("2bhk")}>
              <Ionicons name="images-outline" size={24} color={COLORS.cadSelect} />
              <View style={styles.presetCardBody}>
                <Text style={styles.presetTitle}>2 BHK Plan (1200 sqft)</Text>
                <Text style={styles.presetDesc}>Living Hall, 2 Bedrooms, Kitchen, and Common Bath. 30' x 40' plot footprint.</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* FLOATING ZOOM & PAN CONTROLS */}
      {(viewMode === "2d" || viewMode === "3d" || viewMode === "walkthrough") && (
        <View style={styles.zoomControlsContainer}>
          <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomIn}>
            <Ionicons name="add-outline" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomOut}>
            <Ionicons name="remove-outline" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomBtn} onPress={handleResetView}>
            <Ionicons name="locate-outline" size={20} color={COLORS.cadSelect} />
          </TouchableOpacity>
        </View>
      )}

      {/* FLOATING ACTION TOOLBAR OVERLAY */}
      {viewMode === "2d" && (
        <View style={styles.toolbarOverlay}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarScrollContent}>
            <TouchableOpacity
              style={[styles.toolBtn, tool === "select" && styles.toolBtnActive]}
              onPress={() => setTool("select")}
            >
              <Ionicons name="hand-right-outline" size={20} color={COLORS.white} />
              <Text style={styles.toolBtnText}>Select</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolBtn, tool === "draw_wall" && styles.toolBtnActive]}
              onPress={() => { setTool("draw_wall"); setSelectedItem(null); }}
            >
              <Ionicons name="brush-outline" size={20} color={COLORS.white} />
              <Text style={styles.toolBtnText}>Draw Wall</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={() => setCustomRoomModal(true)}>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.white} />
              <Text style={styles.toolBtnText}>Add Room</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={() => addOpening("door")}>
              <Ionicons name="log-in-outline" size={20} color={COLORS.white} />
              <Text style={styles.toolBtnText}>+ Door</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={() => addOpening("window")}>
              <Ionicons name="browsers-outline" size={20} color={COLORS.white} />
              <Text style={styles.toolBtnText}>+ Window</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={() => addFurniture("bed")}>
              <Ionicons name="bed-outline" size={20} color={COLORS.white} />
              <Text style={styles.toolBtnText}>+ Bed</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={() => addFurniture("sofa")}>
              <Ionicons name="easel-outline" size={20} color={COLORS.white} />
              <Text style={styles.toolBtnText}>+ Sofa</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={() => addFurniture("table")}>
              <Ionicons name="grid-outline" size={20} color={COLORS.white} />
              <Text style={styles.toolBtnText}>+ Table</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={() => addFurniture("toilet")}>
              <Ionicons name="water-outline" size={20} color={COLORS.white} />
              <Text style={styles.toolBtnText}>+ Toilet</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={() => addFurniture("sink")}>
              <Ionicons name="flask-outline" size={20} color={COLORS.white} />
              <Text style={styles.toolBtnText}>+ Sink</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={() => addFurniture("chair")}>
              <Ionicons name="cube-outline" size={20} color={COLORS.white} />
              <Text style={styles.toolBtnText}>+ Chair</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* DETAILED PROPERTIES MODIFICATION BOTTOM SHEET */}
      {selectedItem && viewMode === "2d" && (
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Modify Selected {selectedItem.type.toUpperCase()}</Text>
            <TouchableOpacity onPress={() => setSelectedItem(null)}>
              <Ionicons name="close-circle-outline" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          {selectedItem.type === "room" && (() => {
            const room = rooms.find(r => r.id === selectedItem.id);
            if (!room) return null;
            return (
              <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.sheetLabel}>Room Dimensions:</Text>
                <View style={styles.adjustRow}>
                  <Text style={styles.adjustText}>Width: {room.width / PIXELS_PER_FOOT} ft</Text>
                  <View style={styles.adjustBtnGroup}>
                    <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustRoomWidth(room.id, -1)}>
                      <Text style={styles.adjustBtnText}>- 1'</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustRoomWidth(room.id, 1)}>
                      <Text style={styles.adjustBtnText}>+ 1'</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.adjustRow}>
                  <Text style={styles.adjustText}>Length: {room.height / PIXELS_PER_FOOT} ft</Text>
                  <View style={styles.adjustBtnGroup}>
                    <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustRoomHeight(room.id, -1)}>
                      <Text style={styles.adjustBtnText}>- 1'</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustRoomHeight(room.id, 1)}>
                      <Text style={styles.adjustBtnText}>+ 1'</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Wall Opening Placements */}
                <Text style={styles.sheetLabel}>Add Snap Openings on Walls:</Text>
                <View style={styles.wallGrid}>
                  {["top", "bottom", "left", "right"].map((side) => (
                    <View key={side} style={styles.wallRow}>
                      <Text style={styles.wallName}>{side.toUpperCase()}</Text>
                      <View style={styles.wallBtns}>
                        <TouchableOpacity style={styles.wallInsertBtn} onPress={() => addOpeningToWall(room, side as any, "door")}>
                          <Text style={styles.wallInsertText}>+ Door</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.wallInsertBtn} onPress={() => addOpeningToWall(room, side as any, "window")}>
                          <Text style={styles.wallInsertText}>+ Window</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Label Selection Chips */}
                <Text style={styles.sheetLabel}>Rename Room Space:</Text>
                <View style={styles.chipGrid}>
                  {ROOM_NAME_PRESETS.map((name) => (
                    <TouchableOpacity key={name} style={styles.chip} onPress={() => changeRoomLabel(name)}>
                      <Text style={styles.chipText}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.deleteBtn} onPress={deleteElement}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.deleteBtnText}>Remove Room Space</Text>
                </TouchableOpacity>
              </ScrollView>
            );
          })()}

          {selectedItem.type === "opening" && (() => {
            const op = openings.find(o => o.id === selectedItem.id);
            if (!op) return null;
            const parentInfo = getOpeningParentWall(op);
            return (
              <View style={{ gap: 12 }}>
                <View style={styles.adjustRow}>
                  <TouchableOpacity style={styles.actionBtn} onPress={rotateElement}>
                    <Ionicons name="refresh-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>Rotate Open Gaze</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.danger }]} onPress={deleteElement}>
                    <Ionicons name="trash-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>

                {parentInfo ? (
                  <View style={styles.sliderBox}>
                    <Text style={styles.sheetLabel}>Wall Slider Positioner:</Text>
                    {parentInfo.wall === "top" || parentInfo.wall === "bottom" ? (
                      <View style={styles.sliderRow}>
                        <Text style={styles.sliderLabel}>Left</Text>
                        <Slider
                          style={styles.slider}
                          minimumValue={parentInfo.room.x + 8}
                          maximumValue={parentInfo.room.x + parentInfo.room.width - 8}
                          step={4}
                          value={op.x}
                          onValueChange={(val) => updateOpeningPosition(op.id, val, op.y)}
                          minimumTrackTintColor={COLORS.cadSelect}
                          maximumTrackTintColor="#222"
                          thumbTintColor={COLORS.cadSelect}
                        />
                        <Text style={styles.sliderLabel}>Right</Text>
                      </View>
                    ) : (
                      <View style={styles.sliderRow}>
                        <Text style={styles.sliderLabel}>Top</Text>
                        <Slider
                          style={styles.slider}
                          minimumValue={parentInfo.room.y + 8}
                          maximumValue={parentInfo.room.y + parentInfo.room.height - 8}
                          step={4}
                          value={op.y}
                          onValueChange={(val) => updateOpeningPosition(op.id, op.x, val)}
                          minimumTrackTintColor={COLORS.cadSelect}
                          maximumTrackTintColor="#222"
                          thumbTintColor={COLORS.cadSelect}
                        />
                        <Text style={styles.sliderLabel}>Bottom</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={styles.tipText}>Drag window/door to snap onto a room border first.</Text>
                )}
              </View>
            );
          })()}

          {selectedItem.type === "furniture" && (
            <View style={styles.adjustRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={rotateElement}>
                <Ionicons name="refresh-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>Rotate Furniture</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.danger }]} onPress={deleteElement}>
                <Ionicons name="trash-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}

          {selectedItem.type === "wall" && (
            <TouchableOpacity style={[styles.deleteBtn, { marginTop: 8 }]} onPress={deleteElement}>
              <Ionicons name="trash-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
              <Text style={styles.deleteBtnText}>Remove Drawn Wall Line</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* INPUT DIALOG FOR CUSTOM ROOM DIMENSIONS */}
      <Modal animationType="fade" transparent={true} visible={customRoomModal} onRequestClose={() => setCustomRoomModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Custom Area Size</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.modalLabel}>Width (Feet):</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={inputWidthFt}
                onChangeText={setInputWidthFt}
                placeholder="e.g. 30"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.modalLabel}>Length / Height (Feet):</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={inputHeightFt}
                onChangeText={setInputHeightFt}
                placeholder="e.g. 40"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.modalLabel}>Space Function Label:</Text>
              <TextInput
                style={styles.modalInput}
                value={inputLabel}
                onChangeText={setInputLabel}
                placeholder="e.g. Living Room"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setCustomRoomModal(false)}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={addCustomRoom}>
                <Text style={styles.saveModalBtnText}>Drop Block</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.cadBg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0F1215",
    borderBottomWidth: 1,
    borderBottomColor: "#1E2226",
  },
  backBtn: {
    padding: 6,
  },
  projectInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.white,
    marginLeft: 12,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2E33",
  },
  clearBtn: {
    padding: 6,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#0F1215",
    borderBottomWidth: 1,
    borderBottomColor: "#1E2226",
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: COLORS.cadSelect,
  },
  tabText: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.slate,
    marginLeft: 4,
  },
  tabTextActive: {
    color: COLORS.cadSelect,
  },
  viewport: {
    width: "100%",
    backgroundColor: COLORS.cadBg,
    position: "relative",
  },
  toolbarOverlay: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: "rgba(15, 18, 21, 0.95)",
    borderWidth: 1,
    borderColor: "#2D343B",
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  toolbarScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 12,
  },
  toolBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 70,
  },
  zoomControlsContainer: {
    position: "absolute",
    right: 20,
    top: 140,
    backgroundColor: "rgba(15, 18, 21, 0.9)",
    borderWidth: 1,
    borderColor: "#2D343B",
    borderRadius: 8,
    padding: 6,
    gap: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  zoomBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16191C",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#3D4854",
  },
  toolBtnActive: {
    backgroundColor: "#22272E",
    borderRadius: 8,
  },
  toolBtnText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: "bold",
    marginTop: 4,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 280,
    backgroundColor: "#0F1215",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 2,
    borderTopColor: COLORS.cadSelect,
    padding: 16,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1C2126",
    paddingBottom: 6,
  },
  sheetTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.white,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.cadDimension,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 6,
  },
  adjustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#171A1E",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#272E35",
    marginBottom: 6,
  },
  adjustText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: "bold",
  },
  adjustBtnGroup: {
    flexDirection: "row",
    gap: 8,
  },
  adjustBtn: {
    backgroundColor: "#2C343D",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#3D4854",
  },
  adjustBtnText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "bold",
  },
  wallGrid: {
    gap: 6,
    backgroundColor: "#171A1E",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#272E35",
    marginBottom: 8,
  },
  wallRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wallName: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.slate,
  },
  wallBtns: {
    flexDirection: "row",
    gap: 6,
  },
  wallInsertBtn: {
    backgroundColor: "#23282F",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#353D47",
  },
  wallInsertText: {
    fontSize: 9,
    fontWeight: "bold",
    color: COLORS.white,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: "#1D232A",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A333E",
  },
  chipText: {
    fontSize: 10,
    color: "#CFD8DC",
    fontWeight: "bold",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27303E",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374558",
    marginHorizontal: 3,
  },
  actionBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "bold",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.danger,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  deleteBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "bold",
  },
  sliderBox: {
    backgroundColor: "#171A1E",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#272E35",
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  slider: {
    flex: 1,
    height: 30,
  },
  sliderLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: COLORS.slate,
  },
  tipText: {
    fontSize: 10,
    color: COLORS.slate,
    textAlign: "center",
  },
  presetsOverlay: {
    flex: 1,
    backgroundColor: "#0F1215",
    padding: 16,
  },
  presetsHeading: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.cadSelect,
    paddingLeft: 8,
  },
  presetCard: {
    flexDirection: "row",
    backgroundColor: "#161A1F",
    borderWidth: 1,
    borderColor: "#272E36",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  presetCardBody: {
    flex: 1,
    marginLeft: 16,
  },
  presetTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: COLORS.white,
  },
  presetDesc: {
    fontSize: 10,
    color: COLORS.slate,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#16191C",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#2C343B",
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.white,
    textAlign: "center",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.slate,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: "#0F1215",
    borderWidth: 1,
    borderColor: "#2C343B",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.white,
    fontWeight: "bold",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    gap: 10,
  },
  cancelModalBtn: {
    flex: 1,
    backgroundColor: "#2C343D",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelModalBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.white,
  },
  saveModalBtn: {
    flex: 1,
    backgroundColor: COLORS.cadSelect,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveModalBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E293B",
  },
  camPresetContainer: {
    position: "absolute",
    left: 20,
    top: 20,
    flexDirection: "row",
    backgroundColor: "rgba(15, 18, 21, 0.85)",
    borderWidth: 1,
    borderColor: "#2C343B",
    borderRadius: 8,
    padding: 4,
    gap: 6,
  },
  camPresetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#16191C",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#3D4854",
  },
  camPresetBtnText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: "bold",
  },
});
