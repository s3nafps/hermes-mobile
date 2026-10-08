import * as SecureStore from 'expo-secure-store';

// Native storage: the device keystore (iOS Keychain, Android Keystore).
export async function getItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}
