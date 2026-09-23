import { mergeBookCategories } from './defaultBookCategories';

describe('mergeBookCategories', () => {
  it('keeps only real categories when the database already has entries', () => {
    const categories = [{ id: 'real-1', name: 'Custom Category' }];

    const merged = mergeBookCategories(categories);

    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('Custom Category');
    expect(merged.some((item) => item.name === 'Trigonometry')).toBe(false);
  });

  it('adds fallback defaults only when the database is empty', () => {
    const merged = mergeBookCategories([]);

    expect(merged.some((item) => item.name === 'Trigonometry')).toBe(true);
    expect(merged.some((item) => item.id?.startsWith('default-'))).toBe(true);
  });
});
