import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../constants/theme';

const { width, height } = Dimensions.get('window');

const AmbientBackground = () => {
  return (
    <View style={styles.container}>
      {/* Blob 1: Top Left - Primary/10 */}
      <View style={[styles.blob, styles.blob1]} />
      
      {/* Blob 2: Right Middle - Secondary/10 */}
      <View style={[styles.blob, styles.blob2]} />
      
      {/* Blob 3: Bottom - Tertiary/10 */}
      <View style={[styles.blob, styles.blob3]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    zIndex: -1,
  },
  blob: {
    position: 'absolute',
    borderRadius: 1000,
    opacity: 0.1,
  },
  blob1: {
    top: -height * 0.1,
    left: -width * 0.2,
    width: width * 0.8,
    height: width * 0.8,
    backgroundColor: '#c0c1ff',
    // We rely on the layout wrapper to apply blur if needed, 
    // or just use large size and low opacity
  },
  blob2: {
    top: height * 0.3,
    right: -width * 0.2,
    width: width * 0.7,
    height: width * 0.7,
    backgroundColor: '#44e2cd',
  },
  blob3: {
    bottom: -height * 0.1,
    left: width * 0.1,
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: '#ffb690',
  },
});

export default AmbientBackground;
