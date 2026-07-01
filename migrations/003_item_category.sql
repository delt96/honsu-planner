-- Category tag for each item: 'appliance' (가전) or 'furniture' (가구). Nullable = uncategorized.
ALTER TABLE items ADD COLUMN category text;
