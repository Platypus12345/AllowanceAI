import { PermissionsAndroid, Platform } from 'react-native';

export async function checkSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const read = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
  const recv = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
  return read && recv;
}

export async function requestSmsPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.READ_SMS,
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
  ]);
  return (
    results['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED &&
    results['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED
  );
}
