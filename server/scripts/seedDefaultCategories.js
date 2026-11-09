#!/usr/bin/env node
/**
 * Seed the system default categories (Tracker.md Phase 1 leftover).
 *
 * Without this, a brand-new user signs in to an empty category list and has to invent
 * categories by hand before they can budget anything.
 *
 * A system default is `user_id IS NULL` + `is_default = true`, which is what
 * GET /api/categories returns to every user alongside their own rows. The HTTP route
 * deliberately refuses to set `is_default` (a client-supplied flag would have let any user
 * publish a category into everyone else's list), so this script is the only writer.
 *
 * Idempotent: safe to re-run. It inserts only what is missing and never edits or deletes
 * a user's own categories.
 *
 * Usage, from server/:
 *   npm run seed:categories
 *   npm run seed:categories -- --dry-run
 */

require('dotenv').config();
const prisma = require('../config/prisma');

// Matches the v1 category set (server/models/Expense.js enum and the client's CATEGORIES)
// so v1 data and v2 categories line up instead of drifting apart.
const DEFAULT_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Entertainment',
  'Health',
  'Other',
];

async function seedDefaultCategories({ dryRun = false, log = console.log } = {}) {
  const existing = await prisma.category.findMany({
    where: { isDefault: true, userId: null },
    select: { name: true },
  });
  const have = new Set(existing.map((c) => c.name));
  const missing = DEFAULT_CATEGORIES.filter((name) => !have.has(name));

  if (missing.length === 0) {
    log(`All ${DEFAULT_CATEGORIES.length} default categories already present — nothing to do.`);
    return { created: [], skipped: [...have].sort() };
  }

  if (dryRun) {
    log(`[dry run] would create: ${missing.join(', ')}`);
    return { created: [], skipped: [...have].sort(), wouldCreate: missing };
  }

  await prisma.category.createMany({
    data: missing.map((name) => ({ name, isDefault: true, userId: null })),
  });

  log(`Created ${missing.length} default categor${missing.length === 1 ? 'y' : 'ies'}: ${missing.join(', ')}`);
  if (have.size > 0) log(`Already present, left alone: ${[...have].sort().join(', ')}`);

  return { created: missing, skipped: [...have].sort() };
}

module.exports = { DEFAULT_CATEGORIES, seedDefaultCategories };

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. See server/.env.example.');
    process.exit(1);
  }

  seedDefaultCategories({ dryRun })
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('Seeding default categories failed:', err.message);
      await prisma.$disconnect().catch(() => {});
      process.exit(1);
    });
}
