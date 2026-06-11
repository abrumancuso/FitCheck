# FitCheck — Resumen de Entrega

**FitCheck** es una aplicación mobile para gestionar un guardarropas virtual, armar outfits combinando prendas arrastrándolas sobre un canvas, y compartirlos.

---

## Cómo probar la app

### Opción 1: Expo Go (recomendado)

1. Instalá **Expo Go** en tu celular (iOS o Android):
   - [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Escaneá este QR con la cámara:

   ```
   exp://u.expo.dev/c5fb2e99-a114-4384-8c5f-29a1345100e6
   ```

3. O abrí la URL directamente:
   [https://expo.dev/accounts/abrumancusl/projects/FitCheck](https://expo.dev/accounts/abrumancusl/projects/FitCheck)

### Opción 2: Build local

```bash
git clone https://github.com/abrumancuso/FitCheck.git
cd FitCheck
npm install
npx expo start
```

Luego escaneá el QR con Expo Go desde tu celular en la misma red.

---

## Funcionalidades principales

| Feature | Descripción |
|---------|-------------|
| **Home** | Dashboard con resumen de prendas, categorías y outfit del día aleatorio |
| **Wardrobe** | CRUD completo del guardarropas con filtros por categoría, color y temporada |
| **Agregar prenda** | Carga de foto, selección de categoría/color/temporada, remoción de fondo vía API |
| **Outfit Builder** | Canvas en blanco donde se arrastran prendas, se escala y se posicionan libremente |
| **Smart Match** | Recomendación inteligente: detecta qué falta (top/bottom/shoes) y sugiere una prenda del closet |
| **Outfit Detail** | Vista previa completa, compartir (Share API), guardar como imagen en galería, editar |
| **Editar outfit** | Reabre el builder con las prendas y posiciones guardadas para modificar |
| **Profile** | Estadísticas: cantidad de prendas, categorías, outfits creados, días activo |

---

## Stack técnico

- **Framework**: React Native + Expo SDK 54
- **Navegación**: React Navigation (Stack + Bottom Tabs)
- **Base de datos**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (imágenes de prendas)
- **Drag & Drop**: PanResponder (React Native)
- **Remoción de fondo**: remove.bg API
- **Publicación**: EAS Update (Expo)

---

## Link a GitHub

[https://github.com/abrumancuso/FitCheck](https://github.com/abrumancuso/FitCheck)
