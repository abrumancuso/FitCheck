/**
 * outfitService.js — CRUD de outfits en Supabase
 * ===============================================
 */

import { supabase } from '../config/supabaseClient';

const TABLE = 'outfits';

/**
 * Crea un outfit nuevo y devuelve el registro creado.
 * @param {string} userId
 * @param {Object} data — { name, itemIds, itemSettings }
 * @returns {Promise<Object>} { id, ...data }
 */
export const addOutfit = async (userId, { name, itemIds, itemSettings }) => {
  const { data: record, error } = await supabase
    .from(TABLE)
    .insert({
      name,
      item_ids: itemIds,
      item_count: itemIds.length,
      item_settings: itemSettings || {},
      user_id: userId,
    })
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
