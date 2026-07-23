import { Platform } from "react-native";

const isNative = Platform.OS === "ios" || Platform.OS === "android";

export function createStorage(id: string) {
  if (isNative) {
    // expo-sqlite's kv-store is bundled into Expo Go (no custom native build
    // needed) and exposes a synchronous API matching this abstraction.
    const { SQLiteStorage } = require("expo-sqlite/kv-store");
    const storage = new SQLiteStorage(id);
    return {
      getItem: (name: string) => storage.getItemSync(name),
      setItem: (name: string, value: string) => storage.setItemSync(name, value),
      removeItem: (name: string) => storage.removeItemSync(name),
      getAllKeys: (): string[] => storage.getAllKeysSync(),
    };
  }

  // Web fallback: localStorage
  return {
    getItem: (name: string) => {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: string) => {
      try {
        localStorage.setItem(name, value);
      } catch {}
    },
    removeItem: (name: string) => {
      try {
        localStorage.removeItem(name);
      } catch {}
    },
    getAllKeys: (): string[] => {
      try {
        return Object.keys(localStorage);
      } catch {
        return [];
      }
    },
  };
}
