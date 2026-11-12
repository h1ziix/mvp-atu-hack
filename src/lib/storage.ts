import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export async function readJSON<T>(key: string): Promise<T | null> {
  const value = await AsyncStorage.getItem(`atu:${key}`);
  return value ? (JSON.parse(value) as T) : null;
}
export function writeJSON(key: string, value: unknown) {
  return AsyncStorage.setItem(`atu:${key}`, JSON.stringify(value));
}
export function removeJSON(key: string) {
  return AsyncStorage.removeItem(`atu:${key}`);
}
export async function sessionStorage(value?: string | null) {
  const key = "atu.session.v1";
  const fallbackKey = "atu:session:v1";
  if (value === undefined) {
    if (Platform.OS === "web") return AsyncStorage.getItem(key);
    const secure = await SecureStore.getItemAsync(key).catch(() => null);
    if (secure) return secure;
    return AsyncStorage.getItem(fallbackKey);
  }
  if (value === null) {
    await AsyncStorage.removeItem(fallbackKey).catch(() => {});
    if (Platform.OS === "web") return AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key).catch(() => {});
    return;
  }
  await AsyncStorage.setItem(fallbackKey, value).catch(() => {});
  if (Platform.OS === "web") return AsyncStorage.setItem(key, value);
  await SecureStore.setItemAsync(key, value).catch(() => {});
}
