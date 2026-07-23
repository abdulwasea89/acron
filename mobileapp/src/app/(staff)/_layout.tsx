import { Tabs } from "expo-router";
import { View, Text } from "@/tw";

export default function StaffLayout() {
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
        name="shift"
        options={{
          title: "Shift",
          tabBarIcon: ({ color }) => <TabIcon label="S" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cash-log"
        options={{
          title: "Cash",
          tabBarIcon: ({ color }) => <TabIcon label="$" color={color} />,
        }}
      />
      <Tabs.Screen
        name="receipts"
        options={{
          title: "Receipts",
          tabBarIcon: ({ color }) => <TabIcon label="R" color={color} />,
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
