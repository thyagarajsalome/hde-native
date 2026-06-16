import React, { useState, useEffect } from "react";
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
import Slider from "@react-native-community/slider";
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

// Canvas constants
const CANVAS_SIZE = 400;
const GRID_SIZE = 20;

// Conversion: 4 canvas units = 1 foot (1 canvas unit = 3 inches)
const PIXELS_PER_FOOT = 4;

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

// Preset room templates for quick drop
const ROOM_PRESETS = [
  { label: "Master Bed", w: 56, h: 48, color: "#D1FAE5", defaultLabel: "Master Bed" }, // 14x12 ft
  { label: "Bedroom", w: 48, h: 40, color: "#E0F2FE", defaultLabel: "Bedroom" },    // 12x10 ft
  { label: "Living", w: 64, h: 56, color: "#F0FDF4", defaultLabel: "Living Room" }, // 16x14 ft
  { label: "Kitchen", w: 40, h: 32, color: "#FEF3C7", defaultLabel: "Kitchen" },     // 10x8 ft
  { label: "Bathroom", w: 32, h: 24, color: "#FEE2E2", defaultLabel: "Bathroom" },    // 8x6 ft
  { label: "Balcony", w: 40, h: 16, color: "#FAF5FF", defaultLabel: "Balcony" },     // 10x4 ft
];

interface Room {
  id: string;
  label: string;
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
  rotation: number; // 0, 90, 180, 270
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
  
  // View states
  const [viewMode, setViewMode] = useState<"2d" | "3d" | "templates" | "info">("2d");
  
  // Floor Plan Geometries
  const [rooms, setRooms] = useState<Room[]>([]);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [furniture, setFurniture] = useState<Furniture[]>([]);
  const [projectName, setProjectName] = useState("My Blueprint Creator");
  const [ratePerSqFt, setRatePerSqFt] = useState("1600");

  // Selected item reference
  const [selectedItem, setSelectedItem] = useState<{
    type: "room" | "opening" | "furniture";
    id: string;
  } | null>(null);

  // Modal input states for exact dimensions editing
  const [dimModalVisible, setDimModalVisible] = useState(false);
  const [inputWidthFt, setInputWidthFt] = useState("");
  const [inputHeightFt, setInputHeightFt] = useState("");

  // 3D Orbit parameters
  const [rotationAngle, setRotationAngle] = useState(45);
  const [tiltAngle, setTiltAngle] = useState(30);
  const [zoomScale, setZoomScale] = useState(0.65);

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
    if (rooms.length > 0 || openings.length > 0 || furniture.length > 0) {
      saveDraft();
    }
  }, [rooms, openings, furniture, projectName]);

  // Save/Load Draft locally
  const saveDraft = async () => {
    try {
      const data = JSON.stringify({ rooms, openings, furniture, projectName });
      await AsyncStorage.setItem("hde_simple_floorplan", data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadDraft = async () => {
    try {
      const saved = await AsyncStorage.getItem("hde_simple_floorplan");
      if (saved) {
        const { rooms: r, openings: o, furniture: f, projectName: name } = JSON.parse(saved);
        setRooms(r || []);
        setOpenings(o || []);
        setFurniture(f || []);
        if (name) setProjectName(name);
      } else {
        loadPresetTemplate("1bhk");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const clearCanvas = () => {
    Alert.alert("Reset Canvas", "Are you sure you want to clear your current design?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: () => {
          setRooms([]);
          setOpenings([]);
          setFurniture([]);
          setSelectedItem(null);
          AsyncStorage.removeItem("hde_simple_floorplan");
        },
      },
    ]);
  };

  // Math Helper function for grid snap
  const snap = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  // Add Room Block directly onto canvas center
  const addRoomPreset = (preset: typeof ROOM_PRESETS[0]) => {
    const id = "room_" + Date.now();
    const newRoom: Room = {
      id,
      label: preset.defaultLabel,
      x: snap(CANVAS_SIZE / 2 - preset.w / 2),
      y: snap(CANVAS_SIZE / 2 - preset.h / 2),
      width: preset.w,
      height: preset.h,
      color: preset.color,
    };
    setRooms([...rooms, newRoom]);
    setSelectedItem({ type: "room", id });
    setViewMode("2d");
  };

  // Add Window / Door openings on screen center
  const addOpening = (type: "door" | "window") => {
    const id = "op_" + Date.now();
    const newOp: Opening = {
      id,
      type,
      x: CANVAS_SIZE / 2,
      y: CANVAS_SIZE / 2,
      width: type === "door" ? 28 : 36,
      rotation: 0,
    };
    setOpenings([...openings, newOp]);
    setSelectedItem({ type: "opening", id });
    setViewMode("2d");
  };

  // Add furniture items directly
  const addFurniture = (type: "bed" | "sofa" | "table" | "toilet" | "sink" | "chair") => {
    const id = "furn_" + Date.now();
    const newFurn: Furniture = {
      id,
      type,
      x: snap(CANVAS_SIZE / 2 - 25),
      y: snap(CANVAS_SIZE / 2 - 25),
      width: type === "bed" ? 60 : type === "sofa" ? 70 : 40,
      height: type === "bed" ? 70 : type === "sofa" ? 40 : 40,
      rotation: 0,
    };
    setFurniture([...furniture, newFurn]);
    setSelectedItem({ type: "furniture", id });
    setViewMode("2d");
  };

  // Magnetic snap opening to the nearest room wall
  const getMagneticallySnappedOpening = (x: number, y: number, opWidth: number): { x: number; y: number; rot: number } => {
    if (rooms.length === 0) return { x, y, rot: 0 };
    
    let closestDist = 999999;
    let snapX = x;
    let snapY = y;
    let snapRot = 0;

    rooms.forEach((room) => {
      // Top wall segment
      const dTop = Math.abs(y - room.y);
      if (dTop < closestDist && x >= room.x && x <= room.x + room.width) {
        closestDist = dTop;
        snapX = Math.max(room.x + 8, Math.min(room.x + room.width - 8, x));
        snapY = room.y;
        snapRot = 0;
      }
      // Bottom wall segment
      const dBottom = Math.abs(y - (room.y + room.height));
      if (dBottom < closestDist && x >= room.x && x <= room.x + room.width) {
        closestDist = dBottom;
        snapX = Math.max(room.x + 8, Math.min(room.x + room.width - 8, x));
        snapY = room.y + room.height;
        snapRot = 180;
      }
      // Left wall segment
      const dLeft = Math.abs(x - room.x);
      if (dLeft < closestDist && y >= room.y && y <= room.y + room.height) {
        closestDist = dLeft;
        snapX = room.x;
        snapY = Math.max(room.y + 8, Math.min(room.y + room.height - 8, y));
        snapRot = 270;
      }
      // Right wall segment
      const dRight = Math.abs(x - (room.x + room.width));
      if (dRight < closestDist && y >= room.y && y <= room.y + room.height) {
        closestDist = dRight;
        snapX = room.x + room.width;
        snapY = Math.max(room.y + 8, Math.min(room.y + room.height - 8, y));
        snapRot = 90;
      }
    });

    // Snap to wall if distance is within magnet range (30px)
    if (closestDist < 30) {
      return { x: snapX, y: snapY, rot: snapRot };
    }
    return { x, y, rot: 0 };
  };

  // Find which room and wall an opening is snapped to
  const getOpeningParentWall = (op: Opening) => {
    if (!op) return null;
    for (const room of rooms) {
      // Top wall
      if (Math.abs(op.y - room.y) < 5 && op.x >= room.x - 5 && op.x <= room.x + room.width + 5) {
        return { room, wall: "top" as const };
      }
      // Bottom wall
      if (Math.abs(op.y - (room.y + room.height)) < 5 && op.x >= room.x - 5 && op.x <= room.x + room.width + 5) {
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

  // Add opening directly centered and snapped to a specific wall of a room
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
      width: type === "door" ? 28 : 36,
      rotation,
    };

    setOpenings([...openings, newOp]);
    setSelectedItem({ type: "opening", id });
    setViewMode("2d");
  };

  // Adjust Room width by +/- 1 foot (4 canvas units)
  const adjustRoomWidth = (roomId: string, incrementFt: number) => {
    setRooms(prevRooms => prevRooms.map(r => {
      if (r.id === roomId) {
        const currentFt = r.width / PIXELS_PER_FOOT;
        const newFt = Math.max(4, currentFt + incrementFt); // minimum 4 ft
        return { ...r, width: snap(newFt * PIXELS_PER_FOOT) };
      }
      return r;
    }));
  };

  // Adjust Room height by +/- 1 foot (4 canvas units)
  const adjustRoomHeight = (roomId: string, incrementFt: number) => {
    setRooms(prevRooms => prevRooms.map(r => {
      if (r.id === roomId) {
        const currentFt = r.height / PIXELS_PER_FOOT;
        const newFt = Math.max(4, currentFt + incrementFt); // minimum 4 ft
        return { ...r, height: snap(newFt * PIXELS_PER_FOOT) };
      }
      return r;
    }));
  };

  // Update opening position (e.g. from the slider positioner)
  const updateOpeningPosition = (id: string, x: number, y: number) => {
    setOpenings(prev => prev.map(o => o.id === id ? { ...o, x, y } : o));
  };

  // Touch gesture start
  const handleTouchStart = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;

    // Prioritize checking active wall resize handles of the selected room
    if (selectedItem && selectedItem.type === "room") {
      const room = rooms.find((r) => r.id === selectedItem.id);
      if (room) {
        const hSize = 25; // hit area size
        
        // Right wall handle
        if (Math.abs(locationX - (room.x + room.width)) < hSize && Math.abs(locationY - (room.y + room.height/2)) < hSize) {
          setDraggedItem({ type: "room", id: room.id, handle: "right" });
          return;
        }
        // Left wall handle
        if (Math.abs(locationX - room.x) < hSize && Math.abs(locationY - (room.y + room.height/2)) < hSize) {
          setDraggedItem({ type: "room", id: room.id, handle: "left" });
          return;
        }
        // Bottom wall handle
        if (Math.abs(locationX - (room.x + room.width/2)) < hSize && Math.abs(locationY - (room.y + room.height)) < hSize) {
          setDraggedItem({ type: "room", id: room.id, handle: "bottom" });
          return;
        }
        // Top wall handle
        if (Math.abs(locationX - (room.x + room.width/2)) < hSize && Math.abs(locationY - room.y) < hSize) {
          setDraggedItem({ type: "room", id: room.id, handle: "top" });
          return;
        }
      }
    }

    // Check furniture hits
    const hitFurn = [...furniture].reverse().find(
      (f) => locationX >= f.x && locationX <= f.x + f.width && locationY >= f.y && locationY <= f.y + f.height
    );
    if (hitFurn) {
      setSelectedItem({ type: "furniture", id: hitFurn.id });
      setDraggedItem({ type: "furniture", id: hitFurn.id, handle: "move", offsetX: locationX - hitFurn.x, offsetY: locationY - hitFurn.y });
      return;
    }

    // Check openings hits
    const hitOp = openings.find(
      (o) => Math.abs(locationX - o.x) < 22 && Math.abs(locationY - o.y) < 22
    );
    if (hitOp) {
      setSelectedItem({ type: "opening", id: hitOp.id });
      setDraggedItem({ type: "opening", id: hitOp.id, handle: "move" });
      return;
    }

    // Check rooms hits
    const hitRoom = [...rooms].reverse().find(
      (r) => locationX >= r.x && locationX <= r.x + r.width && locationY >= r.y && locationY <= r.y + r.height
    );
    if (hitRoom) {
      setSelectedItem({ type: "room", id: hitRoom.id });
      
      // Capture child items (furniture and openings) to move them together
      const childFurniture = furniture.filter(f => 
        f.x >= hitRoom.x && f.x + f.width <= hitRoom.x + hitRoom.width && 
        f.y >= hitRoom.y && f.y + f.height <= hitRoom.y + hitRoom.height
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
        offsetX: locationX - hitRoom.x,
        offsetY: locationY - hitRoom.y,
        childFurniture,
        childOpenings
      });
      return;
    }

    // Deselect if tapping empty grid
    setSelectedItem(null);
  };

  // Touch move gestures
  const handleTouchMove = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    if (!draggedItem) return;

    if (draggedItem.type === "room") {
      const room = rooms.find((r) => r.id === draggedItem.id);
      if (!room) return;

      if (draggedItem.handle === "right") {
        const newW = Math.max(20, snap(locationX - room.x));
        setRooms(rooms.map((r) => (r.id === room.id ? { ...r, width: newW } : r)));
      } else if (draggedItem.handle === "left") {
        const newW = Math.max(20, snap(room.x + room.width - locationX));
        const newX = snap(locationX);
        if (newW >= 20) {
          setRooms(rooms.map((r) => (r.id === room.id ? { ...r, x: newX, width: newW } : r)));
        }
      } else if (draggedItem.handle === "bottom") {
        const newH = Math.max(20, snap(locationY - room.y));
        setRooms(rooms.map((r) => (r.id === room.id ? { ...r, height: newH } : r)));
      } else if (draggedItem.handle === "top") {
        const newH = Math.max(20, snap(room.y + room.height - locationY));
        const newY = snap(locationY);
        if (newH >= 20) {
          setRooms(rooms.map((r) => (r.id === room.id ? { ...r, y: newY, height: newH } : r)));
        }
      } else if (draggedItem.handle === "move") {
        const newX = snap(locationX - (draggedItem.offsetX || 0));
        const newY = snap(locationY - (draggedItem.offsetY || 0));

        // Lego-Style Snapping logic (snap edges to other rooms)
        let snappedX = newX;
        let snappedY = newY;
        const SNAP_THRESHOLD = 15;

        for (const other of rooms) {
          if (other.id === room.id) continue;

          // X axis snapping
          if (Math.abs(newX - other.x) < SNAP_THRESHOLD) {
            snappedX = other.x;
          } else if (Math.abs((newX + room.width) - (other.x + other.width)) < SNAP_THRESHOLD) {
            snappedX = other.x + other.width - room.width;
          } else if (Math.abs(newX - (other.x + other.width)) < SNAP_THRESHOLD) {
            snappedX = other.x + other.width;
          } else if (Math.abs((newX + room.width) - other.x) < SNAP_THRESHOLD) {
            snappedX = other.x - room.width;
          }

          // Y axis snapping
          if (Math.abs(newY - other.y) < SNAP_THRESHOLD) {
            snappedY = other.y;
          } else if (Math.abs((newY + room.height) - (other.y + other.height)) < SNAP_THRESHOLD) {
            snappedY = other.y + other.height - room.height;
          } else if (Math.abs(newY - (other.y + other.height)) < SNAP_THRESHOLD) {
            snappedY = other.y + other.height;
          } else if (Math.abs((newY + room.height) - other.y) < SNAP_THRESHOLD) {
            snappedY = other.y - room.height;
          }
        }

        // Update room position
        setRooms(rooms.map((r) => (r.id === room.id ? { ...r, x: Math.max(0, snappedX), y: Math.max(0, snappedY) } : r)));

        // Move child furniture along with the room
        if (draggedItem.childFurniture && draggedItem.childFurniture.length > 0) {
          setFurniture(prev => prev.map(f => {
            const child = draggedItem.childFurniture?.find(c => c.id === f.id);
            if (child) {
              return { ...f, x: snappedX + child.relativeX, y: snappedY + child.relativeY };
            }
            return f;
          }));
        }

        // Move child openings along with the room
        if (draggedItem.childOpenings && draggedItem.childOpenings.length > 0) {
          setOpenings(prev => prev.map(op => {
            const child = draggedItem.childOpenings?.find(c => c.id === op.id);
            if (child) {
              return { ...op, x: snappedX + child.relativeX, y: snappedY + child.relativeY };
            }
            return op;
          }));
        }
      }
    } else if (draggedItem.type === "furniture") {
      const furn = furniture.find((f) => f.id === draggedItem.id);
      if (!furn) return;
      const newX = snap(locationX - (draggedItem.offsetX || 0));
      const newY = snap(locationY - (draggedItem.offsetY || 0));
      setFurniture(furniture.map((f) => (f.id === furn.id ? { ...f, x: Math.max(0, newX), y: Math.max(0, newY) } : f)));
    } else if (draggedItem.type === "opening") {
      const op = openings.find((o) => o.id === draggedItem.id);
      if (!op) return;
      
      // Snaps opening magnetically to walls on drag move
      const snapData = getMagneticallySnappedOpening(locationX, locationY, op.width);
      setOpenings(openings.map((o) => (o.id === op.id ? { ...o, x: snapData.x, y: snapData.y, rotation: snapData.rot } : o)));
    }
  };

  const handleTouchEnd = () => {
    setDraggedItem(null);
  };

  // Edit Room dimensions via custom text input values
  const openDimModal = () => {
    if (selectedItem && selectedItem.type === "room") {
      const room = rooms.find((r) => r.id === selectedItem.id);
      if (room) {
        setInputWidthFt(String(room.width / PIXELS_PER_FOOT));
        setInputHeightFt(String(room.height / PIXELS_PER_FOOT));
        setDimModalVisible(true);
      }
    }
  };

  const saveExactDimensions = () => {
    if (selectedItem && selectedItem.type === "room") {
      const room = rooms.find((r) => r.id === selectedItem.id);
      const wFt = parseFloat(inputWidthFt);
      const hFt = parseFloat(inputHeightFt);

      if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) {
        Alert.alert("Invalid Input", "Please enter positive numbers for dimensions.");
        return;
      }

      setRooms(
        rooms.map((r) =>
          r.id === selectedItem.id
            ? { ...r, width: snap(wFt * PIXELS_PER_FOOT), height: snap(hFt * PIXELS_PER_FOOT) }
            : r
        )
      );
      setDimModalVisible(false);
    }
  };

  // Modify label of selected room
  const changeSelectedRoomLabel = (label: string) => {
    if (selectedItem && selectedItem.type === "room") {
      const presetColors: { [key: string]: string } = {
        "Master Bed": "#D1FAE5",
        Bedroom: "#E0F2FE",
        "Living Room": "#F0FDF4",
        Kitchen: "#FEF3C7",
        Bathroom: "#FEE2E2",
        Balcony: "#FAF5FF",
        Dining: "#FAF5FF",
        Toilet: "#FEE2E2",
        Hall: "#F0FDF4",
      };
      const color = presetColors[label] || "#F1F5F9";
      setRooms(rooms.map((r) => (r.id === selectedItem.id ? { ...r, label, color } : r)));
    }
  };

  const rotateElement = () => {
    if (!selectedItem) return;
    if (selectedItem.type === "furniture") {
      setFurniture(
        furniture.map((f) => (f.id === selectedItem.id ? { ...f, rotation: (f.rotation + 45) % 360 } : f))
      );
    } else if (selectedItem.type === "opening") {
      setOpenings(
        openings.map((o) => (o.id === selectedItem.id ? { ...o, rotation: (o.rotation + 90) % 360 } : o))
      );
    }
  };

  const deleteElement = () => {
    if (!selectedItem) return;
    const { type, id } = selectedItem;
    if (type === "room") {
      setRooms(rooms.filter((r) => r.id !== id));
    } else if (type === "opening") {
      setOpenings(openings.filter((o) => o.id !== id));
    } else if (type === "furniture") {
      setFurniture(furniture.filter((f) => f.id !== id));
    }
    setSelectedItem(null);
  };

  // Area and Cost Math
  const getRoomArea = (room: Room) => {
    return Math.round((room.width / PIXELS_PER_FOOT) * (room.height / PIXELS_PER_FOOT));
  };

  const getTotalArea = () => {
    return rooms.reduce((sum, r) => sum + getRoomArea(r), 0);
  };

  const getEstimatedCost = () => {
    return getTotalArea() * (parseFloat(ratePerSqFt) || 0);
  };

  // Navigations to external calculators
  const handleEstimatePress = () => {
    const totalArea = getTotalArea();
    if (totalArea === 0) {
      Alert.alert("Empty Layout", "Please drop room blocks to calculate area first.");
      return;
    }
    navigation.navigate("ConstructionCalculator", {
      projectData: { area: totalArea.toString() },
      projectName,
    });
  };

  const handleMaterialEstimatePress = () => {
    const totalArea = getTotalArea();
    if (totalArea === 0) {
      Alert.alert("Empty Layout", "Please drop room blocks to calculate area first.");
      return;
    }
    navigation.navigate("MaterialCalculator", {
      projectData: { area: totalArea.toString() },
      projectName,
    });
  };

  // Pre-loaded Blueprint layouts
  const loadPresetTemplate = (type: "1bhk" | "2bhk" | "studio") => {
    setSelectedItem(null);
    if (type === "studio") {
      setRooms([
        { id: "r1", label: "Studio Hall", x: 40, y: 60, width: 200, height: 200, color: "#E0F2FE" },
        { id: "r2", label: "Bathroom", x: 240, y: 60, width: 120, height: 100, color: "#FEE2E2" },
        { id: "r3", label: "Kitchen", x: 240, y: 160, width: 120, height: 100, color: "#FEF3C7" },
      ]);
      setOpenings([
        { id: "o1", type: "door", x: 40, y: 140, width: 28, rotation: 90 },
        { id: "o2", type: "door", x: 240, y: 110, width: 28, rotation: 90 },
        { id: "o3", type: "door", x: 240, y: 210, width: 28, rotation: 90 },
        { id: "o4", type: "window", x: 140, y: 60, width: 36, rotation: 0 },
        { id: "o5", type: "window", x: 360, y: 210, width: 36, rotation: 90 },
      ]);
      setFurniture([
        { id: "f1", type: "bed", x: 60, y: 80, width: 60, height: 70, rotation: 0 },
        { id: "f2", type: "sofa", x: 150, y: 180, width: 70, height: 40, rotation: 180 },
        { id: "f3", type: "toilet", x: 310, y: 80, width: 25, height: 35, rotation: 0 },
      ]);
    } else if (type === "1bhk") {
      setRooms([
        { id: "r1", label: "Living Room", x: 40, y: 40, width: 180, height: 180, color: "#F0FDF4" },
        { id: "r2", label: "Master Bed", x: 220, y: 40, width: 140, height: 180, color: "#D1FAE5" },
        { id: "r3", label: "Kitchen", x: 40, y: 220, width: 180, height: 140, color: "#FEF3C7" },
        { id: "r4", label: "Bathroom", x: 220, y: 220, width: 140, height: 140, color: "#FEE2E2" },
      ]);
      setOpenings([
        { id: "o1", type: "door", x: 40, y: 130, width: 28, rotation: 90 },
        { id: "o2", type: "door", x: 220, y: 80, width: 28, rotation: 90 },
        { id: "o3", type: "door", x: 220, y: 280, width: 28, rotation: 90 },
        { id: "o4", type: "window", x: 130, y: 40, width: 36, rotation: 0 },
        { id: "o5", type: "window", x: 290, y: 40, width: 36, rotation: 0 },
      ]);
      setFurniture([
        { id: "f1", type: "bed", x: 260, y: 60, width: 60, height: 70, rotation: 0 },
        { id: "f2", type: "sofa", x: 60, y: 70, width: 70, height: 40, rotation: 0 },
      ]);
    } else if (type === "2bhk") {
      setRooms([
        { id: "r1", label: "Living Room", x: 40, y: 40, width: 160, height: 160, color: "#F0FDF4" },
        { id: "r2", label: "Master Bed", x: 200, y: 40, width: 160, height: 160, color: "#D1FAE5" },
        { id: "r3", label: "Kids Bed", x: 40, y: 200, width: 160, height: 160, color: "#E0F2FE" },
        { id: "r4", label: "Kitchen", x: 200, y: 200, width: 100, height: 160, color: "#FEF3C7" },
        { id: "r5", label: "Toilet", x: 300, y: 200, width: 60, height: 160, color: "#FEE2E2" },
      ]);
      setOpenings([
        { id: "o1", type: "door", x: 40, y: 120, width: 28, rotation: 90 },
        { id: "o2", type: "door", x: 200, y: 80, width: 28, rotation: 90 },
        { id: "o3", type: "door", x: 100, y: 200, width: 28, rotation: 0 },
        { id: "o4", type: "door", x: 240, y: 200, width: 28, rotation: 0 },
        { id: "o5", type: "door", x: 300, y: 260, width: 28, rotation: 90 },
      ]);
      setFurniture([
        { id: "f1", type: "bed", x: 250, y: 60, width: 60, height: 70, rotation: 0 },
        { id: "f2", type: "bed", x: 60, y: 220, width: 60, height: 70, rotation: 0 },
      ]);
    }
    setViewMode("2d");
  };

  // Export PDF Report Blueprint
  const handleExportPDF = async () => {
    const totalArea = getTotalArea();
    const cost = getEstimatedCost();

    const svgContent = `
      <svg width="600" height="600" viewBox="0 0 400 400" style="background:#ffffff; border: 1px solid #cbd5e1; margin: auto; display: block;">
        ${rooms
          .map(
            (r) => `
          <rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${r.color}" stroke="#1E293B" stroke-width="4"/>
          <text x="${r.x + r.width / 2}" y="${r.y + r.height / 2 - 5}" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold" fill="#1E293B">${r.label}</text>
          <text x="${r.x + r.width / 2}" y="${r.y + r.height / 2 + 8}" text-anchor="middle" font-family="Arial" font-size="8" fill="#64748B">${Math.round(r.width / 4)}'x${Math.round(r.height / 4)}' (${getRoomArea(r)} sq ft)</text>
        `
          )
          .join("")}
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
            body { font-family: Arial, sans-serif; color: #1e293b; padding: 30px; }
            h1 { font-size: 22px; color: #1e293b; margin: 0; }
            h2 { font-size: 13px; color: #64748b; font-weight: normal; margin: 5px 0 20px 0; }
            .header { border-bottom: 2px solid #cbd5e1; padding-bottom: 15px; margin-bottom: 25px; }
            .badge { background: #d9a443; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
            .section-title { font-size: 15px; font-weight: bold; margin-top: 25px; margin-bottom: 10px; border-left: 4px solid #d9a443; padding-left: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
            th { background: #f8fafc; }
            .total-row { font-weight: bold; background: #f1f5f9; }
            .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <table style="border:none; width:100%; margin:0;">
              <tr style="border:none;">
                <td style="border:none; padding:0;">
                  <h1>${projectName}</h1>
                  <h2>Professional Blueprint Report & Estimates</h2>
                </td>
                <td align="right" style="border:none; padding:0; font-size:11px;">
                  <strong>HDE Platform</strong><br>
                  Date: ${new Date().toLocaleDateString()}<br>
                  Status: <span class="badge">APPROVED PLAN</span>
                </td>
              </tr>
            </table>
          </div>

          <div class="section-title">2D Layout Design Sketch</div>
          ${svgContent}

          <div class="section-title">Room & Carpet Area Details</div>
          <table>
            <thead>
              <tr>
                <th>Space Function</th>
                <th>Dimensions (Feet)</th>
                <th>Carpet Area (Sq Ft)</th>
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
                </tr>
              `
                )
                .join("")}
              <tr class="total-row">
                <td colspan="2">Total Carpet Area</td>
                <td>${totalArea} sq ft</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">HDE Civil Cost Estimate</div>
          <table>
            <thead>
              <tr>
                <th>Calculation Factor</th>
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

          <div class="footer">
            Generated via HDE: Floor Plan & Estimator app. All rights reserved.
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Export PDF Plan" });
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not generate PDF report.");
    }
  };

  // 3D Isometric rotation mappings
  const toIsometric = (x: number, y: number, z: number = 0) => {
    // 1. Rotate around canvas center (200, 200)
    const radRot = (rotationAngle * Math.PI) / 180;
    const dx = x - 200;
    const dy = y - 200;
    const rotX = dx * Math.cos(radRot) - dy * Math.sin(radRot) + 200;
    const rotY = dx * Math.sin(radRot) + dy * Math.cos(radRot) + 200;

    // 2. Project into isometric coordinates
    const radTilt = (tiltAngle * Math.PI) / 180;
    const centerX = 200;
    const centerY = 180;

    const isoX = (rotX - rotY) * Math.cos(30 * Math.PI / 180) * zoomScale + centerX;
    const isoY = ((rotX + rotY) * Math.sin(radTilt) - z) * zoomScale + centerY;

    return { x: isoX, y: isoY, depth: rotY };
  };

  const renderIsometricScene = () => {
    const list: React.ReactNode[] = [];
    const wallHeight = 42; // wall extrusion height

    // 1. Draw Ground Room Floor Slabs
    rooms.forEach((room) => {
      const p1 = toIsometric(room.x, room.y);
      const p2 = toIsometric(room.x + room.width, room.y);
      const p3 = toIsometric(room.x + room.width, room.y + room.height);
      const p4 = toIsometric(room.x, room.y + room.height);

      list.push(
        <G key={`iso_room_${room.id}`}>
          <Path d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z`} fill={room.color} stroke="#94A3B8" strokeWidth={0.5} />
          <SvgText x={(p1.x + p3.x) / 2} y={(p1.y + p3.y) / 2} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#334155">
            {room.label}
          </SvgText>
        </G>
      );
    });

    // 2. Depth sort all standing structures (Walls, Doors/Windows, Furniture)
    const elementsToRender: { depth: number; element: React.ReactNode }[] = [];

    // Walls (Automatic box borders for each room)
    rooms.forEach((room) => {
      // 4 walls per room box
      const wallsList = [
        { sx: room.x, sy: room.y, ex: room.x + room.width, ey: room.y, tag: "top" },
        { sx: room.x + room.width, sy: room.y, ex: room.x + room.width, ey: room.y + room.height, tag: "right" },
        { sx: room.x, sy: room.y + room.height, ex: room.x + room.width, ey: room.y + room.height, tag: "bottom" },
        { sx: room.x, sy: room.y, ex: room.x, ey: room.y + room.height, tag: "left" },
      ];

      wallsList.forEach((w, idx) => {
        const midX = (w.sx + w.ex) / 2;
        const midY = (w.sy + w.ey) / 2;
        const midProj = toIsometric(midX, midY);

        const b1 = toIsometric(w.sx, w.sy);
        const b2 = toIsometric(w.ex, w.ey);
        const t1 = toIsometric(w.sx, w.sy, wallHeight);
        const t2 = toIsometric(w.ex, w.ey, wallHeight);

        const wallColor = (w.tag === "top" || w.tag === "bottom") ? "#475569" : "#64748B";

        elementsToRender.push({
          depth: midProj.depth,
          element: (
            <G key={`iso_wall_${room.id}_${idx}`}>
              <Path d={`M ${b1.x} ${b1.y} L ${b2.x} ${b2.y} L ${t2.x} ${t2.y} L ${t1.x} ${t1.y} Z`} fill={wallColor} stroke="#1E293B" strokeWidth={0.5} />
              <Line x1={t1.x} y1={t1.y} x2={t2.x} y2={t2.y} stroke="#94A3B8" strokeWidth={4} strokeLinecap="round" />
            </G>
          ),
        });
      });
    });

    // Openings
    openings.forEach((op) => {
      const pos = toIsometric(op.x, op.y);
      elementsToRender.push({
        depth: pos.depth,
        element: op.type === "door" ? (
          <Circle key={`iso_op_${op.id}`} cx={pos.x} cy={pos.y} r={4} fill="#D9A443" stroke="#94A3B8" strokeWidth={0.5} />
        ) : (
          <Circle key={`iso_op_${op.id}`} cx={pos.x} cy={pos.y} r={4} fill="#3B82F6" stroke="#94A3B8" strokeWidth={0.5} />
        ),
      });
    });

    // Furniture
    furniture.forEach((f) => {
      const w = f.width;
      const h = f.height;
      const zh = 16;

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
        element: (
          <G key={`iso_furn_${f.id}`}>
            <Path d={`M ${b1.x} ${b1.y} L ${b2.x} ${b2.y} L ${t2.x} ${t2.y} L ${t1.x} ${t1.y} Z`} fill="#CBD5E1" stroke="#64748B" strokeWidth={0.5} />
            <Path d={`M ${b2.x} ${b2.y} L ${b3.x} ${b3.y} L ${t3.x} ${t3.y} L ${t2.x} ${t2.y} Z`} fill="#94A3B8" stroke="#64748B" strokeWidth={0.5} />
            <Path d={`M ${t1.x} ${t1.y} L ${t2.x} ${t2.y} L ${t3.x} ${t3.y} L ${t4.x} ${t4.y} Z`} fill="#E2E8F0" stroke="#64748B" strokeWidth={0.5} />
          </G>
        ),
      });
    });

    // Sort by depth (painter's algorithm)
    elementsToRender.sort((a, b) => a.depth - b.depth);
    elementsToRender.forEach((item) => list.push(item.element));
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
          onChangeText={setProjectName}
          placeholder="Blueprint Title"
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity style={styles.infoBtn} onPress={() => setViewMode("info")}>
          <Ionicons name="information-circle-outline" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Mode selectors */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tabBtn, viewMode === "2d" && styles.tabActive]} onPress={() => setViewMode("2d")}>
          <Ionicons name="map-outline" size={16} color={viewMode === "2d" ? COLORS.gold : COLORS.slate} />
          <Text style={[styles.tabText, viewMode === "2d" && styles.tabTextActive]}>2D Editor</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tabBtn, viewMode === "3d" && styles.tabActive]} onPress={() => setViewMode("3d")}>
          <Ionicons name="cube-outline" size={16} color={viewMode === "3d" ? COLORS.gold : COLORS.slate} />
          <Text style={[styles.tabText, viewMode === "3d" && styles.tabTextActive]}>3D Viewer</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tabBtn, viewMode === "templates" && styles.tabActive]} onPress={() => setViewMode("templates")}>
          <Ionicons name="file-tray-full-outline" size={16} color={viewMode === "templates" ? COLORS.gold : COLORS.slate} />
          <Text style={[styles.tabText, viewMode === "templates" && styles.tabTextActive]}>Presets</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 2D CANVAS WORKSPACE */}
        {viewMode === "2d" && (
          <View style={styles.editorContainer}>
            
            {/* Quick Add Presets Bar */}
            <Text style={styles.presetHeading}>Step 1: Tap to Add Rooms</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsBar}>
              {ROOM_PRESETS.map((preset) => (
                <TouchableOpacity key={preset.label} style={styles.presetBadge} onPress={() => addRoomPreset(preset)}>
                  <View style={[styles.presetDot, { backgroundColor: preset.color }]} />
                  <Text style={styles.presetLabelText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.presetHeading}>Step 2: Drag Room Borders & Magnetic Snaps</Text>
            <View style={styles.actionsBar}>
              <Text style={styles.tipText}>
                {selectedItem
                  ? "Drag room to move, or drag red arrow handles to resize walls."
                  : "Tap a room block to edit dimensions or rename."}
              </Text>
              <TouchableOpacity style={styles.clearBtn} onPress={clearCanvas}>
                <Ionicons name="trash-outline" size={14} color={COLORS.white} />
                <Text style={styles.clearBtnText}>Reset</Text>
              </TouchableOpacity>
            </View>

            {/* Drawing Canvas */}
            <View style={styles.canvasContainer}>
              <View
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
              >
                <Svg width={CANVAS_SIZE} height={CANVAS_SIZE}>
                  <Defs>
                    <Pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                      <Path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#F1F5F9" strokeWidth="1" />
                    </Pattern>
                  </Defs>

                  <Rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill="url(#grid)" />
                  <Rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill="none" stroke="#E2E8F0" strokeWidth={1} />

                  {/* 1. Render Room Blocks */}
                  {rooms.map((room) => {
                    const isSelected = selectedItem?.type === "room" && selectedItem?.id === room.id;
                    const rWidthFt = room.width / PIXELS_PER_FOOT;
                    const rHeightFt = room.height / PIXELS_PER_FOOT;

                    return (
                      <G key={room.id}>
                        {/* Floor Slab Rect */}
                        <Rect
                          x={room.x}
                          y={room.y}
                          width={room.width}
                          height={room.height}
                          fill={room.color}
                          stroke={isSelected ? COLORS.gold : COLORS.navy}
                          strokeWidth={isSelected ? 4 : 3}
                        />
                        {/* Labels & Area */}
                        <SvgText x={room.x + room.width / 2} y={room.y + room.height / 2 - 5} textAnchor="middle" fontSize={10} fontWeight="bold" fill={COLORS.navy}>
                          {room.label}
                        </SvgText>
                        
                        {/* Dimension labels displayed directly on borders */}
                        <SvgText x={room.x + room.width / 2} y={room.y + 12} textAnchor="middle" fontSize={9} fill={COLORS.slate} fontWeight="500">
                          {rWidthFt} ft
                        </SvgText>
                        <SvgText x={room.x + 8} y={room.y + room.height / 2 + 3} textAnchor="start" fontSize={9} fill={COLORS.slate} fontWeight="500">
                          {rHeightFt} ft
                        </SvgText>

                        {/* Interactive Drag Handles on all 4 walls (shown only when selected) */}
                        {isSelected && (
                          <G>
                            {/* Right border handle */}
                            <Circle cx={room.x + room.width} cy={room.y + room.height / 2} r={7} fill="#EF4444" />
                            {/* Left border handle */}
                            <Circle cx={room.x} cy={room.y + room.height / 2} r={7} fill="#EF4444" />
                            {/* Bottom border handle */}
                            <Circle cx={room.x + room.width / 2} cy={room.y + room.height} r={7} fill="#EF4444" />
                            {/* Top border handle */}
                            <Circle cx={room.x + room.width / 2} cy={room.y} r={7} fill="#EF4444" />
                          </G>
                        )}
                      </G>
                    );
                  })}

                  {/* 2. Render Openings (Doors / Windows) snapped magnetically */}
                  {openings.map((op) => {
                    const isSelected = selectedItem?.type === "opening" && selectedItem?.id === op.id;
                    return (
                      <G key={op.id} transform={`rotate(${op.rotation}, ${op.x}, ${op.y})`}>
                        {op.type === "door" ? (
                          <G>
                            <Path d={`M ${op.x} ${op.y} A ${op.width} ${op.width} 0 0 1 ${op.x + op.width} ${op.y + op.width}`} fill="none" stroke={isSelected ? COLORS.gold : COLORS.gold} strokeWidth={1} strokeDasharray="2,2" />
                            <Line x1={op.x} y1={op.y} x2={op.x} y2={op.y + op.width} stroke={isSelected ? COLORS.gold : "#CD8B23"} strokeWidth={3.5} />
                            <Circle cx={op.x} cy={op.y} r={4} fill={COLORS.gold} />
                          </G>
                        ) : (
                          <Rect x={op.x - op.width / 2} y={op.y - 4} width={op.width} height={8} fill="#FFFFFF" stroke={isSelected ? COLORS.gold : COLORS.accent} strokeWidth={2} />
                        )}
                      </G>
                    );
                  })}

                  {/* 3. Render Furniture */}
                  {furniture.map((f) => {
                    const isSelected = selectedItem?.type === "furniture" && selectedItem?.id === f.id;
                    return (
                      <G key={f.id} transform={`rotate(${f.rotation}, ${f.x + f.width / 2}, ${f.y + f.height / 2})`}>
                        <Rect x={f.x} y={f.y} width={f.width} height={f.height} rx={2} fill="#E2E8F0" stroke={isSelected ? COLORS.gold : "#94A3B8"} strokeWidth={1.5} />
                        <SvgText x={f.x + f.width / 2} y={f.y + f.height / 2 + 3} textAnchor="middle" fontSize={7} fill={COLORS.slate} fontWeight="500">
                          {f.type.toUpperCase()}
                        </SvgText>
                      </G>
                    );
                  })}
                </Svg>
              </View>
            </View>

            {/* Quick Openings & Furniture Tool palette */}
            <Text style={styles.presetHeading}>Step 3: Drop Openings & Furniture</Text>
            <View style={styles.quickAddBar}>
              <TouchableOpacity style={styles.quickAddBtn} onPress={() => addOpening("door")}>
                <Ionicons name="open-outline" size={18} color={COLORS.navy} />
                <Text style={styles.quickAddBtnText}>+ Door</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAddBtn} onPress={() => addOpening("window")}>
                <Ionicons name="square-outline" size={18} color={COLORS.navy} />
                <Text style={styles.quickAddBtnText}>+ Window</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAddBtn} onPress={() => addFurniture("bed")}>
                <Ionicons name="bed-outline" size={18} color={COLORS.navy} />
                <Text style={styles.quickAddBtnText}>+ Bed</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAddBtn} onPress={() => addFurniture("sofa")}>
                <Ionicons name="easel-outline" size={18} color={COLORS.navy} />
                <Text style={styles.quickAddBtnText}>+ Sofa</Text>
              </TouchableOpacity>
            </View>

            {/* Editing attributes panel */}
            {selectedItem && (
              <View style={styles.editPanel}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>Modify Selected {selectedItem.type.toUpperCase()}</Text>
                  <TouchableOpacity onPress={() => setSelectedItem(null)}>
                    <Ionicons name="close-circle-outline" size={20} color={COLORS.slate} />
                  </TouchableOpacity>
                </View>

                {selectedItem.type === "room" && (() => {
                  const room = rooms.find((r) => r.id === selectedItem.id);
                  if (!room) return null;
                  return (
                    <View style={{ gap: 10 }}>
                      {/* Adjust Size Incremental Buttons */}
                      <Text style={styles.label}>Adjust Room Size:</Text>
                      <View style={styles.dimensionAdjustGrid}>
                        <View style={styles.adjustRow}>
                          <Text style={styles.adjustLabel}>Width: {room.width / PIXELS_PER_FOOT} ft</Text>
                          <View style={styles.adjustBtnGroup}>
                            <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustRoomWidth(room.id, -1)}>
                              <Text style={styles.adjustBtnText}>- 1 ft</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustRoomWidth(room.id, 1)}>
                              <Text style={styles.adjustBtnText}>+ 1 ft</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.adjustRow}>
                          <Text style={styles.adjustLabel}>Height: {room.height / PIXELS_PER_FOOT} ft</Text>
                          <View style={styles.adjustBtnGroup}>
                            <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustRoomHeight(room.id, -1)}>
                              <Text style={styles.adjustBtnText}>- 1 ft</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustRoomHeight(room.id, 1)}>
                              <Text style={styles.adjustBtnText}>+ 1 ft</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      {/* Precise input button */}
                      <TouchableOpacity style={styles.primaryActionBtn} onPress={openDimModal}>
                        <Ionicons name="resize-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                        <Text style={styles.primaryActionBtnText}>Input Exact Dimensions (ft)</Text>
                      </TouchableOpacity>

                      {/* Place Snapped Opening on Wall */}
                      <Text style={styles.label}>Add Opening to Selected Room Wall:</Text>
                      <View style={styles.wallButtonsGrid}>
                        <View style={styles.wallButtonsRow}>
                          <Text style={styles.wallLabel}>Top Wall</Text>
                          <View style={styles.wallBtnGroup}>
                            <TouchableOpacity style={styles.wallBtn} onPress={() => addOpeningToWall(room, "top", "door")}>
                              <Ionicons name="open-outline" size={12} color={COLORS.navy} />
                              <Text style={styles.wallBtnText}>+ Door</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.wallBtn} onPress={() => addOpeningToWall(room, "top", "window")}>
                              <Ionicons name="square-outline" size={12} color={COLORS.navy} />
                              <Text style={styles.wallBtnText}>+ Window</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.wallButtonsRow}>
                          <Text style={styles.wallLabel}>Bottom Wall</Text>
                          <View style={styles.wallBtnGroup}>
                            <TouchableOpacity style={styles.wallBtn} onPress={() => addOpeningToWall(room, "bottom", "door")}>
                              <Ionicons name="open-outline" size={12} color={COLORS.navy} />
                              <Text style={styles.wallBtnText}>+ Door</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.wallBtn} onPress={() => addOpeningToWall(room, "bottom", "window")}>
                              <Ionicons name="square-outline" size={12} color={COLORS.navy} />
                              <Text style={styles.wallBtnText}>+ Window</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.wallButtonsRow}>
                          <Text style={styles.wallLabel}>Left Wall</Text>
                          <View style={styles.wallBtnGroup}>
                            <TouchableOpacity style={styles.wallBtn} onPress={() => addOpeningToWall(room, "left", "door")}>
                              <Ionicons name="open-outline" size={12} color={COLORS.navy} />
                              <Text style={styles.wallBtnText}>+ Door</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.wallBtn} onPress={() => addOpeningToWall(room, "left", "window")}>
                              <Ionicons name="square-outline" size={12} color={COLORS.navy} />
                              <Text style={styles.wallBtnText}>+ Window</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.wallButtonsRow}>
                          <Text style={styles.wallLabel}>Right Wall</Text>
                          <View style={styles.wallBtnGroup}>
                            <TouchableOpacity style={styles.wallBtn} onPress={() => addOpeningToWall(room, "right", "door")}>
                              <Ionicons name="open-outline" size={12} color={COLORS.navy} />
                              <Text style={styles.wallBtnText}>+ Door</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.wallBtn} onPress={() => addOpeningToWall(room, "right", "window")}>
                              <Ionicons name="square-outline" size={12} color={COLORS.navy} />
                              <Text style={styles.wallBtnText}>+ Window</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      {/* Room labeling presets */}
                      <Text style={styles.label}>Rename Room Label:</Text>
                      <View style={styles.chipGrid}>
                        {["Living Room", "Master Bed", "Bedroom", "Kids Bed", "Kitchen", "Bathroom", "Dining", "Toilet", "Hall"].map((l) => (
                          <TouchableOpacity key={l} style={styles.chip} onPress={() => changeSelectedRoomLabel(l)}>
                            <Text style={styles.chipText}>{l}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })()}

                {selectedItem.type === "opening" && (() => {
                  const op = openings.find((o) => o.id === selectedItem.id);
                  if (!op) return null;
                  const parentInfo = getOpeningParentWall(op);
                  return (
                    <View style={{ gap: 10 }}>
                      <TouchableOpacity style={styles.rotateBtn} onPress={rotateElement}>
                        <Ionicons name="refresh-outline" size={16} color={COLORS.navy} style={{ marginRight: 6 }} />
                        <Text style={styles.rotateBtnText}>Rotate Element</Text>
                      </TouchableOpacity>

                      {parentInfo ? (
                        <View style={styles.sliderContainer}>
                          <Text style={styles.label}>Slide Position Along {parentInfo.wall.toUpperCase()} Wall:</Text>
                          {parentInfo.wall === "top" || parentInfo.wall === "bottom" ? (
                            <View style={styles.sliderRow}>
                              <Text style={styles.sliderSideLabel}>Left</Text>
                              <Slider
                                style={styles.sliderComponent}
                                minimumValue={parentInfo.room.x + 8}
                                maximumValue={parentInfo.room.x + parentInfo.room.width - 8}
                                step={4}
                                value={op.x}
                                onValueChange={(val) => updateOpeningPosition(op.id, val, op.y)}
                                minimumTrackTintColor={COLORS.gold}
                                maximumTrackTintColor={COLORS.slateLight}
                                thumbTintColor={COLORS.gold}
                              />
                              <Text style={styles.sliderSideLabel}>Right</Text>
                            </View>
                          ) : (
                            <View style={styles.sliderRow}>
                              <Text style={styles.sliderSideLabel}>Top</Text>
                              <Slider
                                style={styles.sliderComponent}
                                minimumValue={parentInfo.room.y + 8}
                                maximumValue={parentInfo.room.y + parentInfo.room.height - 8}
                                step={4}
                                value={op.y}
                                onValueChange={(val) => updateOpeningPosition(op.id, op.x, val)}
                                minimumTrackTintColor={COLORS.gold}
                                maximumTrackTintColor={COLORS.slateLight}
                                thumbTintColor={COLORS.gold}
                              />
                              <Text style={styles.sliderSideLabel}>Bottom</Text>
                            </View>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.tipText}>Move window/door onto a room wall to enable wall sliding positioner.</Text>
                      )}
                    </View>
                  );
                })()}

                {selectedItem.type === "furniture" && (
                  <TouchableOpacity style={styles.rotateBtn} onPress={rotateElement}>
                    <Ionicons name="refresh-outline" size={16} color={COLORS.navy} style={{ marginRight: 6 }} />
                    <Text style={styles.rotateBtnText}>Rotate Element</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.deleteBtn} onPress={deleteElement}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.deleteBtnText}>Remove Element</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* 3D VIEWER WORKSPACE */}
        {viewMode === "3d" && (
          <View style={styles.viewer3DContainer}>
            <View style={styles.infoCard3D}>
              <Ionicons name="sparkles" size={18} color={COLORS.gold} />
              <Text style={styles.infoCard3DText}>
                3D Isometric Extrusion representation. Rotate, tilt, and zoom to inspect model spacing.
              </Text>
            </View>

            <View style={styles.canvasContainer}>
              <Svg width={CANVAS_SIZE} height={CANVAS_SIZE} style={{ backgroundColor: "#F1F5F9", borderRadius: 12 }}>
                {renderIsometricScene()}
              </Svg>
            </View>

            {/* Orbit Controls */}
            <View style={styles.orbitControlsContainer}>
              <Text style={styles.controlSectionTitle}>3D Orbit & Zoom Controls</Text>
              
              <View style={styles.controlRow}>
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

                <TouchableOpacity style={styles.reset3DBtn} onPress={() => { setRotationAngle(45); setTiltAngle(30); setZoomScale(0.65); }}>
                  <Ionicons name="refresh-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.reset3DBtnText}>Reset Camera</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* TEMPLATES LOADING */}
        {viewMode === "templates" && (
          <View style={styles.templatesContainer}>
            <Text style={styles.cardTitle}>Load Predefined Blueprints</Text>
            
            <TouchableOpacity style={styles.templateCard} onPress={() => loadPresetTemplate("studio")}>
              <View style={styles.templateIcon}>
                <Ionicons name="home-outline" size={24} color={COLORS.gold} />
              </View>
              <View style={styles.templateContent}>
                <Text style={styles.templateTitle}>1 Room Studio Layout (320 sq ft)</Text>
                <Text style={styles.templateDesc}>Compact modern studio featuring 1 bathroom, 1 kitchenette, and open bedroom area.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.templateCard} onPress={() => loadPresetTemplate("1bhk")}>
              <View style={styles.templateIcon}>
                <Ionicons name="business-outline" size={24} color={COLORS.gold} />
              </View>
              <View style={styles.templateContent}>
                <Text style={styles.templateTitle}>Standard 1 BHK Blueprint (450 sq ft)</Text>
                <Text style={styles.templateDesc}>Classic 1 Bedroom, 1 Hall, 1 Kitchen, and 1 toilet layout ideal for standard plots.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.templateCard} onPress={() => loadPresetTemplate("2bhk")}>
              <View style={styles.templateIcon}>
                <Ionicons name="images-outline" size={24} color={COLORS.gold} />
              </View>
              <View style={styles.templateContent}>
                <Text style={styles.templateTitle}>Standard 2 BHK Layout Plan (800 sq ft)</Text>
                <Text style={styles.templateDesc}>Spacious 2 Bedrooms, 1 large Hall, 1 separate Kitchen, and toilet layout. Best for growing families.</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ESTIMATOR DETAILS & COST BANNERS */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionHeader}>Blueprint Estimation Summary</Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Area</Text>
              <Text style={styles.summaryVal}>{getTotalArea()} sq ft</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Carpet Rooms</Text>
              <Text style={styles.summaryVal}>{rooms.length} Blocks</Text>
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

          <View style={styles.costBanner}>
            <View style={styles.costLeft}>
              <Text style={styles.costTitle}>Est. Construction Cost</Text>
              <Text style={styles.costValue}>Rs. {getEstimatedCost().toLocaleString()}</Text>
            </View>
          </View>

          {/* Integration buttons */}
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

          <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF}>
            <Ionicons name="document-text-outline" size={20} color={COLORS.navy} />
            <Text style={styles.exportBtnText}>Export PDF Blueprint Report</Text>
          </TouchableOpacity>
        </View>

        {/* INFO TAB DOCUMENTATION */}
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
                HDE Floor Plan Creator combines a professional block-based 2D blueprint editor with a real-time isometric 3D visualizer. Designed to optimize civil calculations, material takeoff, and area estimates.
              </Text>
              <Text style={styles.infoSubtitle}>How it simplifies layout sketching:</Text>
              <Text style={styles.infoLi}>• <strong>Block-Based Editing:</strong> Zero complicated wall lines. Select a pre-sized space preset (e.g. Master Bedroom, Kitchen) and drop it directly.</Text>
              <Text style={styles.infoLi}>• <strong>Wall Drag Handles:</strong> Push or pull borders on all 4 directions to easily size rooms.</Text>
              <Text style={styles.infoLi}>• <strong>Exact dimensions (ft):</strong> Tap the size tags to enter exact lengths manually.</Text>
              <Text style={styles.infoLi}>• <strong>Magnetic Snap Openings:</strong> Window and door elements snap flat against the nearest room wall automatically.</Text>
            </ScrollView>
          </View>
        )}

      </ScrollView>

      {/* DIMENSION ENTRY DIALOG MODAL */}
      <Modal animationType="fade" transparent={true} visible={dimModalVisible} onRequestClose={() => setDimModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Exact Room Dimensions</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.modalLabel}>Width (Feet):</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={inputWidthFt}
                onChangeText={setInputWidthFt}
                placeholder="e.g. 12"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.modalLabel}>Height (Feet):</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={inputHeightFt}
                onChangeText={setInputHeightFt}
                placeholder="e.g. 10"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setDimModalVisible(false)}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={saveExactDimensions}>
                <Text style={styles.saveModalBtnText}>Apply Size</Text>
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
  presetHeading: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.navy,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 6,
  },
  presetsBar: {
    flexDirection: "row",
    marginBottom: 16,
  },
  presetBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    elevation: 1,
  },
  presetDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  presetLabelText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.navy,
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
    lineHeight: 15,
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
  quickAddBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
    marginBottom: 16,
  },
  quickAddBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bg,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
  },
  quickAddBtnText: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.navy,
    marginLeft: 4,
  },
  editPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
    padding: 16,
    marginBottom: 16,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateLight,
    paddingBottom: 8,
    marginBottom: 12,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: COLORS.navy,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryActionBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "bold",
  },
  label: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.slate,
    marginTop: 4,
  },
  chipGrid: {
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
  chipText: {
    fontSize: 11,
    color: COLORS.slate,
    fontWeight: "500",
  },
  rotateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.slateLight,
    paddingVertical: 10,
    borderRadius: 8,
  },
  rotateBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.navy,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  deleteBtnText: {
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
    lineHeight: 15,
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
    fontSize: 11,
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
    fontSize: 10,
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
  dimensionAdjustGrid: {
    gap: 8,
    marginBottom: 8,
  },
  adjustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
  },
  adjustLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.navy,
  },
  adjustBtnGroup: {
    flexDirection: "row",
    gap: 6,
  },
  adjustBtn: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  adjustBtnText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "bold",
  },
  wallButtonsGrid: {
    gap: 8,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
    marginBottom: 8,
  },
  wallButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wallLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.slate,
    minWidth: 70,
  },
  wallBtnGroup: {
    flexDirection: "row",
    gap: 8,
  },
  wallBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
  },
  wallBtnText: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.navy,
    marginLeft: 4,
  },
  sliderContainer: {
    marginTop: 6,
    gap: 6,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
  },
  sliderComponent: {
    flex: 1,
    height: 40,
    marginHorizontal: 8,
  },
  sliderSideLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.slate,
  },
  infoLi: {
    fontSize: 12,
    color: COLORS.slate,
    lineHeight: 18,
    marginBottom: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.navy,
    marginBottom: 16,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.slate,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.slateLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.navy,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    gap: 10,
  },
  cancelModalBtn: {
    flex: 1,
    backgroundColor: COLORS.slateLight,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelModalBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.navy,
  },
  saveModalBtn: {
    flex: 1,
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveModalBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.white,
  },
});
