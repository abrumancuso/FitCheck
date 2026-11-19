import { Modal, View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';

export default function MissingItemSuggestionModal({
  visible,
  suggestion,
  onClose,
}) {
  const { scale, fontScale, verticalScale } = useAppScale();
  const S = (n) => scale(n);
  const FS = (n) => fontScale(n);
  const VS = (n) => verticalScale(n);

  if (!suggestion) return null;

  const handleOpenLink = async () => {
    if (!suggestion.url) return;
    try {
      const canOpen = await Linking.canOpenURL(suggestion.url);
      if (canOpen) {
        await Linking.openURL(suggestion.url);
      }
    } catch (_) {}
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: S(24),
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: S(320),
            backgroundColor: COLORS.white,
            borderRadius: S(16),
            padding: S(24),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: VS(10) },
            shadowOpacity: 0.25,
            shadowRadius: S(20),
            elevation: 10,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: S(16) }}>
            <View
              style={{
                width: S(56),
                height: S(56),
                borderRadius: S(28),
                backgroundColor: COLORS.primary + '15',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: S(12),
              }}
            >
              <Ionicons name="bag-outline" size={S(28)} color={COLORS.primary} />
            </View>
            <Text
              style={{
                fontSize: FS(18),
                fontWeight: '700',
                color: COLORS.text,
                textAlign: 'center',
              }}
            >
              Tu look está casi listo
            </Text>
          </View>

          <Text
            style={{
              fontSize: FS(14),
              color: COLORS.textLight,
              textAlign: 'center',
              lineHeight: FS(20),
              marginBottom: S(16),
            }}
          >
            Esta prenda es el toque final que tu look necesitaba. ¿La buscamos?
          </Text>

          <View
            style={{
              backgroundColor: COLORS.background,
              borderRadius: S(12),
              padding: S(16),
              marginBottom: S(20),
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text
              style={{
                fontSize: FS(16),
                fontWeight: '600',
                color: COLORS.text,
                textAlign: 'center',
                marginBottom: S(4),
              }}
            >
              {suggestion.itemName}
            </Text>
            <Text
              style={{
                fontSize: FS(14),
                color: COLORS.primary,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {suggestion.brand}
            </Text>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: S(12),
              paddingVertical: S(14),
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: S(8),
              marginBottom: S(10),
            }}
            onPress={handleOpenLink}
            activeOpacity={0.85}
          >
            <Ionicons name="cart-outline" size={FS(18)} color="#fff" />
            <Text style={{ color: '#fff', fontSize: FS(15), fontWeight: '600' }}>
              Comprarla en {suggestion.brand}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              paddingVertical: S(12),
              alignItems: 'center',
            }}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: FS(14), color: COLORS.textLight, fontWeight: '500' }}>
              Ahora no
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
