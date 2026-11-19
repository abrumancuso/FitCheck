/**
 * outfitService.js — CRUD de outfits en Supabase
 * ===============================================
 */

import { supabase } from '../config/supabaseClient';

const TABLE = 'outfits';

/**
 * Crea un outfit nuevo y devuelve el registro creado.
 * @param {string} userId
 * @param {Object} data — { name, itemIds, itemSettings, imageUrl?, isAiGenerated? }
 * @returns {Promise<Object>} { id, ...data }
 *
 * Los campos de imagen son OPCIONALES y solo se envían si vienen: así un
 * outfit armado a mano sigue guardándose igual aunque todavía no se haya
 * ejecutado la migración SQL que agrega `image_url` / `is_ai_generated`.
 */
export const addOutfit = async (userId, {
  name, itemIds, itemSettings, imageUrl, isAiGenerated,
}) => {
  const insert = {
    name,
    item_ids: itemIds,
    item_count: itemIds.length,
    item_settings: itemSettings || {},
    user_id: userId,
  };
  if (imageUrl !== undefined) insert.image_url = imageUrl;
  if (isAiGenerated !== undefined) insert.is_ai_generated = isAiGenerated;

  const { data: record, error } = await supabase
    .from(TABLE)
    .insert(insert)
    .select()
    .single();
  if (error) throw error;
  return record;
};

/**
 * Trae TODOS los outfits de un usuario, ordenados por fecha descendente.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export const getOutfits = async (userId) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

/**
 * Actualiza un outfit existente.
 * @param {string} outfitId
 * @param {Object} data — { name?, itemIds?, itemSettings? }
 *
 * NUNCA toca `image_url` ni `is_ai_generated`: los looks IA no son
 * editables en el builder, así que su imagen no puede pisarse.
 */
export const updateOutfit = async (outfitId, data) => {
  const updates = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.itemIds !== undefined) {
    updates.item_ids = data.itemIds;
    updates.item_count = data.itemIds.length;
  }
  if (data.itemSettings !== undefined) updates.item_settings = data.itemSettings;

  const { error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('id', outfitId);
  if (error) throw error;
};

/**
 * Elimina un outfit por ID.
 * @param {string} userId
 * @param {string} outfitId
 */
export const deleteOutfit = async (userId, outfitId) => {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', outfitId)
    .eq('user_id', userId);
  if (error) throw error;
};
