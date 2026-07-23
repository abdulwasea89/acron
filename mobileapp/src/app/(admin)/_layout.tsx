import { Tabs } from "expo-router";
import { View, Text } from "@/tw";

export default function AdminLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <TabIcon label="D" color={color} />,
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: "Approve",
          tabBarIcon: ({ color }) => <TabIcon label="A" color={color} />,
        }}
      />
      <Tabs.Screen
        name="gym-status"
        options={{
          title: "Status",
          tabBarIcon: ({ color }) => <TabIcon label="!" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color }) => <TabIcon label="T" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabIcon label="M" color={color} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ label, color }: { label: string; color: string }) {
  return (
    <View className="w-6 h-6 items-center justify-center">
      <Text style={{ color, fontSize: 14, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}
