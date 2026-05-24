import { registerRootComponent } from "expo";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { UserProvider } from "./context/UserContext";
import RootNavigator from "./navigation/RootNavigator";

const Root = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <UserProvider>
        <RootNavigator />
      </UserProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

registerRootComponent(Root);
