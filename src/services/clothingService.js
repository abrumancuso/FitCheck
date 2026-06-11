/**
 * clothingService.js — CRUD de prendas en Supabase
 * ==================================================
 */

import { supabase } from '../config/supabaseClient';

const TABLE = 'clothing_items';

/**
 * Agrega una prenda nueva y devuelve el registro creado.
 * @param {string} userId
 * @param {Object} data — { imageUrl, category, color, season, description }
 * @returns {Promise<Object>} { id, ...data }
 */
export const addClothingItem = async (userId, data) => {
  const { data: record, error } = await supabase
    .from(TABLE)
    .insert({ ...data, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return record;
};

/**
 * Trae TODAS las prendas de un usuario, ordenadas por fecha descendente.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export const getClothingItems = async (userId) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

/**
 * Actualiza campos de una prenda.
 * @param {string} itemId
 * @param {Object} updates
 */
export const updateClothingItem = async (itemId, updates) => {
  const { error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('id', itemId);
  if (error) throw error;
};

/**
 * Elimina una prenda por ID.
 * @param {string} userId
 * @param {string} itemId
 */
export const deleteClothingItem = async (userId, itemId) => {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId);
  if (error) throw error;
};

/** Categorías disponibles */
export const CATEGORIES = [
  'Remera', 'Camisa', 'Blusa', 'Buzo', 'Sweater',
  'Campera', 'Abrigo', 'Blazer', 'Vestido', 'Falda',
  'Pantalón', 'Short', 'Pollera', 'Zapatos', 'Cartera', 'Accesorio',
];

export const SEASONS = ['Todas', 'Primavera', 'Verano', 'Otoño', 'Invierno'];

export const COLORS_LIST = [
  { label: 'Negro', value: '#1A1A1A' },
  { label: 'Blanco', value: '#FFFFFF' },
  { label: 'Gris', value: '#8A8A8A' },
  { label: 'Beige', value: '#D4C5A9' },
  { label: 'Crema', value: '#FDF8F0' },
  { label: 'Borgoña', value: '#6B1D2B' },
  { label: 'Rojo', value: '#C0392B' },
  { label: 'Rosa', value: '#E8A0BF' },
  { label: 'Verde Militar', value: '#4A5D23' },
  { label: 'Verde', value: '#27AE60' },
  { label: 'Azul', value: '#2C6B9E' },
  { label: 'Celeste', value: '#85C1E9' },
  { label: 'Amarillo', value: '#F1C40F' },
  { label: 'Naranja', value: '#E67E22' },
  { label: 'Lila', value: '#9B59B6' },
  { label: 'Dorado', value: '#C9A84C' },
  { label: 'Plateado', value: '#BDC3C7' },
  { label: 'Jean', value: '#4A6FA5' },
];
