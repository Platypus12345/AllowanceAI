import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMerchantCategory } from '@/src/services/merchantMapper';
import { Colors, Fonts } from '@/constants/theme';

export default function QRScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>We need your permission to show the camera</Text>
        <TouchableOpacity 
          onPress={requestPermission}
          style={styles.permissionButton}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    if (data.startsWith('upi://pay')) {
      const params: Record<string, string> = {};
      const query = data.split('?')[1];
      if (query) {
        query.split('&').forEach(pair => {
          const [key, val] = pair.split('=');
          params[key] = decodeURIComponent(val || '');
        });
      }

      const merchantName = params['pn'] || 'UPI Merchant';
      const amount = params['am'] || '';
      const category = getMerchantCategory(merchantName);

      router.replace({
        pathname: '/add-expense',
        params: {
          amount,
          description: merchantName,
          category,
          fromQR: 'true'
        }
      });
    } else {
      Alert.alert('Invalid QR', 'This is not a valid UPI payment QR code.', [
        { text: 'Try Again', onPress: () => setScanned(false) }
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        enableTorch={torch}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => router.back()}
              style={styles.iconButton}
            >
              <MaterialIcons name="close" color="white" size={24} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setTorch(!torch)}
              style={styles.iconButton}
            >
              <MaterialIcons name={torch ? "flash-on" : "flash-off"} color={torch ? Colors.tertiary : "white"} size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.finderContainer}>
            <View style={styles.finder}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.hint}>Align QR code within the frame</Text>
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionText: {
    color: Colors.onSurface,
    textAlign: 'center',
    fontFamily: Fonts.plus,
    fontSize: 16,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
  },
  permissionButtonText: {
    color: 'white',
    fontFamily: Fonts.plusBold,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  finderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finder: {
    width: 260,
    height: 260,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: Colors.primary,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 30,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 30,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 30,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 30,
  },
  hint: {
    color: 'white',
    fontFamily: Fonts.plusBold,
    fontSize: 16,
    marginTop: 40,
    textAlign: 'center',
    opacity: 0.8,
  },
});
