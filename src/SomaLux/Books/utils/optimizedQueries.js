/**
 * Book queries used by the catalogue and search views.
 */
export async function fetchBooksOptimized(supabase, page = 1, booksPerPage = 20) {
  const from = (page - 1) * booksPerPage;
  const to = from + booksPerPage;

  const booksResult = await supabase
    .from('books')
    .select('id, title, author, description, cover_image_url, file_url, downloads_count, pages, rating, rating_count, created_at')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (booksResult.error) throw booksResult.error;

  const books = booksResult.data || [];
  return {
    books: books.slice(0, booksPerPage),
    page,
    hasMore: books.length > booksPerPage,
  };
}

export async function fetchBookDetailsBatch(supabase, bookIds) {
  if (!bookIds || bookIds.length === 0) return [];

  const { data, error } = await supabase
    .from('books')
    .select('*')
    .in('id', bookIds);

  if (error) throw error;
  return data || [];
}

export async function searchBooksOptimized(supabase, query, limit = 20) {
  if (!query || query.length < 2) return [];

  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, cover_image_url')
    .or(`title.ilike.%${query}%,author.ilike.%${query}%`)
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function fetchMinimalBooks(supabase, page = 1, limit = 20) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, cover_image_url, rating, rating_count')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return data || [];
}
