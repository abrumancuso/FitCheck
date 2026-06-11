/**
 * Skeleton.js — Esqueleto con shimmer para carga
 * ===============================================
 *
 * Uso:
 *   <Skeleton width={100} height={100} borderRadius={12} />
 *   <Skeleton.Text lines={3} />
 *
 * Efecto shimmer vía Animated API (sin dependencias externas).
 */

import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';

// ─── Shimmer hook ───────────────────────────────────────────────

function useShimmer() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  return shimmer;
}

// ─── Skeleton base ──────────────────────────────────────────────

export default function Skeleton({ width, height, borderRadius = 8, style }) {
  const shimmer = useShimmer();

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E8E0D6',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          opacity,
          backgroundColor: '#F5F0EB',
        }}
      />
    </View>
  );
}

// ─── Círculo ────────────────────────────────────────────────────

Skeleton.Circle = function SkeletonCircle({ size, style }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />;
};

// ─── Bloque de texto ────────────────────────────────────────────

Skeleton.Text = function SkeletonText({ lines = 3, width = '100%', style }) {
  const shimmer = useShimmer();

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const lineWidths = ['100%', '85%', '60%'];

  return (
    <View style={[{ gap: 8 }, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 14,
            borderRadius: 7,
            width: lineWidths[i] || '50%',
            backgroundColor: '#E8E0D6',
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={{
              ...StyleSheet.absoluteFillObject,
              opacity,
              backgroundColor: '#F5F0EB',
            }}
          />
        </View>
      ))}
    </View>
  );
};

// ─── Card completa ──────────────────────────────────────────────

Skeleton.Card = function SkeletonCard({ style }) {
  const shimmer = useShimmer();
  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View
      style={[{
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      }, style]}
    >
      {/* Fila: círculo + líneas */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 44, height: 44, borderRadius: 10,
          backgroundColor: '#E8E0D6', overflow: 'hidden',
        }}>
          <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity, backgroundColor: '#F5F0EB' }} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ height: 14, width: '70%', borderRadius: 7, backgroundColor: '#E8E0D6', overflow: 'hidden' }}>
            <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity, backgroundColor: '#F5F0EB' }} />
          </View>
          <View style={{ height: 10, width: '40%', borderRadius: 5, backgroundColor: '#E8E0D6', overflow: 'hidden' }}>
            <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity, backgroundColor: '#F5F0EB' }} />
          </View>
        </View>
      </View>
      {/* Segunda línea */}
      <View style={{ height: 10, width: '100%', borderRadius: 5, backgroundColor: '#E8E0D6', overflow: 'hidden' }}>
        <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity, backgroundColor: '#F5F0EB' }} />
      </View>
      <View style={{ height: 10, width: '60%', borderRadius: 5, backgroundColor: '#E8E0D6', overflow: 'hidden' }}>
        <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity, backgroundColor: '#F5F0EB' }} />
      </View>
    </View>
  );
};
