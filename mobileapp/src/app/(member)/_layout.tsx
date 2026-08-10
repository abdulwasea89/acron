import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import { TabIcon } from "@/components/tab-icon";

export default function MemberLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const active = isDark ? "#fafafa" : "#0a0a0a";
  const inactive = isDark ? "#6e6e6e" : "#94a3b8";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarStyle: {
          backgroundColor: isDark ? "#0a0a0a" : "#ffffff",
          borderTopColor: isDark ? "#1f1f1f" : "#edf0f5",
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="house" android="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="classes"
        options={{
          title: "Classes",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="calendar" android="event" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: "Payments",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="creditcard" android="payments" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" android="person" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
