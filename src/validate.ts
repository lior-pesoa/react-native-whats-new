import type { WhatsNewRelease } from './types';

export type ValidateNotesResult =
  { ok: true; notes: WhatsNewRelease[] } | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;

function isObject(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUriSource(value: unknown): boolean {
  return isObject(value) && typeof value.uri === 'string' && value.uri !== '';
}

function optionalString(
  obj: Obj,
  key: string,
  path: string,
  errors: string[]
): void {
  if (obj[key] !== undefined && typeof obj[key] !== 'string') {
    errors.push(`${path}.${key} must be a string when set`);
  }
}

function validateRow(row: unknown, path: string, errors: string[]): void {
  if (!isObject(row)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof row.title !== 'string') {
    errors.push(`${path}.title must be a string`);
  }
  optionalString(row, 'description', path, errors);
  // From JSON an icon can only be a remote image.
  if (row.icon !== undefined && !isUriSource(row.icon)) {
    errors.push(`${path}.icon must be { uri: string } when set`);
  }
}

function validatePage(page: unknown, path: string, errors: string[]): void {
  if (!isObject(page)) {
    errors.push(`${path} must be an object`);
    return;
  }
  switch (page.type) {
    case 'list':
      if (typeof page.title !== 'string') {
        errors.push(`${path}.title must be a string`);
      }
      if (!Array.isArray(page.rows)) {
        errors.push(`${path}.rows must be an array`);
        return;
      }
      page.rows.forEach((row, i) =>
        validateRow(row, `${path}.rows[${i}]`, errors)
      );
      return;
    case 'media':
      if (page.kind !== 'image' && page.kind !== 'video') {
        errors.push(`${path}.kind must be 'image' or 'video'`);
      }
      if (!isUriSource(page.source)) {
        errors.push(`${path}.source must be { uri: string }`);
      }
      if (page.poster !== undefined && !isUriSource(page.poster)) {
        errors.push(`${path}.poster must be { uri: string } when set`);
      }
      if (
        page.aspectRatio !== undefined &&
        !(
          typeof page.aspectRatio === 'number' &&
          Number.isFinite(page.aspectRatio) &&
          page.aspectRatio > 0
        )
      ) {
        errors.push(`${path}.aspectRatio must be a positive number when set`);
      }
      optionalString(page, 'title', path, errors);
      optionalString(page, 'description', path, errors);
      return;
    case 'custom':
      errors.push(
        `${path}.type 'custom' needs a render function, so it can't come from JSON`
      );
      return;
    default:
      errors.push(`${path}.type must be 'list' or 'media'`);
  }
}

/**
 * Checks release notes loaded from JSON (a remote config, a CMS) before
 * they reach the sheet. Errors carry paths like `[1].pages[0].rows[2].title`.
 */
export function validateNotes(json: unknown): ValidateNotesResult {
  if (!Array.isArray(json)) {
    return { ok: false, errors: ['notes must be an array of releases'] };
  }
  const errors: string[] = [];
  json.forEach((release, r) => {
    const path = `[${r}]`;
    if (!isObject(release)) {
      errors.push(`${path} must be an object`);
      return;
    }
    if (typeof release.version !== 'string' || release.version.trim() === '') {
      errors.push(`${path}.version must be a non-empty string`);
    }
    if (!Array.isArray(release.pages)) {
      errors.push(`${path}.pages must be an array`);
      return;
    }
    release.pages.forEach((page, i) =>
      validatePage(page, `${path}.pages[${i}]`, errors)
    );
  });
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, notes: json as WhatsNewRelease[] };
}
