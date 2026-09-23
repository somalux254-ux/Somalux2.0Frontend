import { supabase } from './supabaseClient';
import { UNIQUE_DEFAULT_BOOK_CATEGORIES, normalizeCategoryName } from './defaultBookCategories';

export async function seedDefaultCategories() {
  try {
    const { data: existingRows, error: fetchError } = await supabase
      .from('categories')
      .select('id, name');

    if (fetchError) throw fetchError;

    const namesInDb = new Set(
      (existingRows || [])
        .map((row) => normalizeCategoryName(row.name))
        .filter(Boolean)
    );

    const missing = Array.from(
      new Map(
        UNIQUE_DEFAULT_BOOK_CATEGORIES.map((name) => [normalizeCategoryName(name), name])
      ).values()
    ).filter((name) => {
      const normalized = normalizeCategoryName(name);
      return normalized && !namesInDb.has(normalized);
    });

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('categories_cache_v2');
    }

    if (missing.length === 0) {
      console.log('Default categories already seeded.');
      return { inserted: 0, total: (existingRows || []).length };
    }

    const { error: insertError } = await supabase
      .from('categories')
      .insert(missing.map((name) => ({ name })));

    if (insertError) throw insertError;

    console.log(`Seeded ${missing.length} default categories.`);
    return { inserted: missing.length, total: (existingRows || []).length + missing.length };
  } catch (error) {
    console.error('Failed to seed default categories:', error);
    throw error;
  }
}

export default seedDefaultCategories;
