import { validateNotes } from '../validate';

const errorsOf = (json: unknown): string[] => {
  const result = validateNotes(json);
  return result.ok ? [] : result.errors;
};

describe('validateNotes', () => {
  it('accepts list and media pages', () => {
    const json = [
      {
        version: '1.2.0',
        pages: [
          {
            type: 'list',
            title: 'New',
            rows: [
              { title: 'Faster', description: 'Much.' },
              { title: 'Icons', icon: { uri: 'https://x.test/i.png' } },
            ],
          },
          {
            type: 'media',
            kind: 'video',
            source: { uri: 'https://x.test/v.mp4' },
            poster: { uri: 'https://x.test/p.jpg' },
            title: 'Watch',
          },
        ],
      },
    ];
    const result = validateNotes(json);
    expect(result.ok).toBe(true);
    expect(result.ok && result.notes).toBe(json);
  });

  it('rejects custom pages with their path', () => {
    const errors = errorsOf([{ version: '1', pages: [{ type: 'custom' }] }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^\[0\]\.pages\[0\]\.type .*custom/);
  });

  it('points at a row without a title', () => {
    const errors = errorsOf([
      {
        version: '1',
        pages: [{ type: 'list', title: 'x', rows: [{ title: 'a' }, {}] }],
      },
    ]);
    expect(errors.some((e) => e.startsWith('[0].pages[0].rows[1].title'))).toBe(
      true
    );
  });

  it('rejects anything but an array', () => {
    expect(errorsOf({ version: '1', pages: [] })).toHaveLength(1);
    expect(errorsOf(null)).toHaveLength(1);
  });

  it('rejects unknown media kinds', () => {
    const errors = errorsOf([
      {
        version: '1',
        pages: [{ type: 'media', kind: 'gif', source: { uri: 'x' } }],
      },
    ]);
    expect(errors).toEqual(["[0].pages[0].kind must be 'image' or 'video'"]);
  });

  it('accepts a positive aspectRatio and rejects anything else', () => {
    const page = (aspectRatio: unknown) => [
      {
        version: '1',
        pages: [
          { type: 'media', kind: 'image', source: { uri: 'x' }, aspectRatio },
        ],
      },
    ];
    expect(validateNotes(page(0.75)).ok).toBe(true);
    expect(errorsOf(page(0))).toEqual([
      '[0].pages[0].aspectRatio must be a positive number when set',
    ]);
    expect(errorsOf(page('3/4'))).toEqual([
      '[0].pages[0].aspectRatio must be a positive number when set',
    ]);
  });
});
