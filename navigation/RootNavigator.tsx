import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Import Screens
import HomeScreen from "../screens/HomeScreen";
import PlanGalleryScreen from "../screens/PlanGalleryScreen";
import DirectoryScreen from "../screens/DirectoryScreen";
import DashboardScreen from "../screens/DashboardScreen";
import LoginScreen from "../screens/LoginScreen";
import SignUpScreen from "../screens/SignUpScreen";
import UpgradeScreen from "../screens/UpgradeScreen";
import ConstructionCalculatorScreen from "../screens/ConstructionCalculatorScreen";
import MaterialCalculatorScreen from "../screens/MaterialCalculatorScreen";
import OtherCalculatorScreen from "../screens/OtherCalculatorScreen";
import ProRegistrationScreen from "../screens/ProRegistrationScreen";
import FloorPlanScreen from "../screens/FloorPlanScreen";

// Import Legal Pages
import PrivacyPolicyScreen from "../screens/PrivacyPolicyScreen";
import TermsOfServiceScreen from "../screens/TermsOfServiceScreen";
import AboutUsScreen from "../screens/AboutUsScreen";

export type RootStackParamList = {
  MainTabs: undefined;
  ConstructionCalculator: { projectData?: any; projectName?: string } | undefined;
  MaterialCalculator: { projectData?: any; projectName?: string } | undefined;
  OtherCalculator: { type: string; projectData?: any; projectName?: string };
  Login: undefined;
  SignUp: undefined;
  Upgrade: undefined;
  ProRegistration: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  AboutUs: undefined;
  FloorPlanGenerator: undefined;
};

export type TabParamList = {
  TabHome: undefined;
  TabPlans: undefined;
  TabDirectory: undefined;
  TabProfile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home";

          if (route.name === "TabHome") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "TabPlans") {
            iconName = focused ? "images" : "images-outline";
          } else if (route.name === "TabDirectory") {
            iconName = focused ? "business" : "business-outline";
          } else if (route.name === "TabProfile") {
            iconName = focused ? "person" : "person-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#D9A443", // HDE Gold / Amber
        tabBarInactiveTintColor: "#94A3B8", // Slate
        tabBarStyle: {
          backgroundColor: "#1E293B", // Navy
          borderTopColor: "#334155",
          paddingBottom: insets.bottom > 0 ? insets.bottom + 4 : 8,
          paddingTop: 8,
          height: 60 + (insets.bottom > 0 ? insets.bottom - 4 : 0),
        },
        headerStyle: {
          backgroundColor: "#1E293B",
        },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      })}
    >
      <Tab.Screen
        name="TabHome"
        component={HomeScreen}
        options={{ title: "HDE Tools", headerShown: false }}
      />
      <Tab.Screen
        name="TabPlans"
        component={PlanGalleryScreen}
        options={{ title: "Plan Gallery", headerTitle: "Premium House Plans" }}
      />
      <Tab.Screen
        name="TabDirectory"
        component={DirectoryScreen}
        options={{ title: "Directory", headerTitle: "Verified Professionals" }}
      />
      <Tab.Screen
        name="TabProfile"
        component={DashboardScreen}
        options={{ title: "My Dashboard", headerTitle: "Account Dashboard" }}
      />
    </Tab.Navigator>
  );
};

const RootNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerStyle: {
            backgroundColor: "#1E293B",
          },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: {
            fontWeight: "bold",
          },
          contentStyle: {
            backgroundColor: "#F8FAFC",
          },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ConstructionCalculator"
          component={ConstructionCalculatorScreen}
          options={{ title: "House Construction Cost" }}
        />
        <Stack.Screen
          name="MaterialCalculator"
          component={MaterialCalculatorScreen}
          options={{ title: "Material Quantity Estimate" }}
        />
        <Stack.Screen
          name="OtherCalculator"
          component={OtherCalculatorScreen}
          options={({ route }) => ({
            title: route.params.type.replace(/-/g, " ").replace(/\w\S*/g, (w) => w.replace(/^\w/, (c) => c.toUpperCase())) + " Calculator"
          })}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: "Sign In" }}
        />
        <Stack.Screen
          name="SignUp"
          component={SignUpScreen}
          options={{ title: "Sign Up" }}
        />
        <Stack.Screen
          name="Upgrade"
          component={UpgradeScreen}
          options={{ title: "Upgrade to Pro" }}
        />
        <Stack.Screen
          name="ProRegistration"
          component={ProRegistrationScreen}
          options={{ title: "Manage Professional Listing" }}
        />

        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{ title: "Privacy Policy" }}
        />
        <Stack.Screen
          name="TermsOfService"
          component={TermsOfServiceScreen}
          options={{ title: "Terms of Service" }}
        />
        <Stack.Screen
          name="AboutUs"
          component={AboutUsScreen}
          options={{ title: "About HDE" }}
        />
        <Stack.Screen
          name="FloorPlanGenerator"
          component={FloorPlanScreen}
          options={{ title: "Floor Plan Creator & Designer" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
