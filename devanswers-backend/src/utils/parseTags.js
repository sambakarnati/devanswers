/**
 * Splits a comma-separated tags string into trimmed, non-empty tag names.
 * A missing/blank `tags` value is treated as "no tags" (tags are optional on
 * both question creation and edit) rather than throwing, or producing a
 * bogus empty-named Tag document the way `"".split(",")` would.
 */
export const parseTagsToArray = (tags) => {
  return (tags ?? "")
    .trim()
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
};
