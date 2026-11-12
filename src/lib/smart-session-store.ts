import * as SecureStore from "expo-secure-store";
const key = "atu.ai-session.v1";
export const readSmartSession = () => SecureStore.getItemAsync(key);
export const writeSmartSession = (value: string | null) =>
  value === null
    ? SecureStore.deleteItemAsync(key)
    : SecureStore.setItemAsync(key, value);
