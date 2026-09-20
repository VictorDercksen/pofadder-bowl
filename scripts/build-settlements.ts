/**
 * Builds the settlements data migration from the GeoNames gazetteer (https://www.geonames.org,
 * CC BY 4.0): every populated place in South Africa except suburbs and sections of towns,
 * abandoned or destroyed places. The result is a batched upsert that `supabase db push`
 * applies like any other migration.
 *
 *   npx tsx scripts/build-settlements.ts [--zip path/to/ZA.zip] [--out supabase/migrations/<file>.sql]
 *
 * Re-run to refresh the table from a newer GeoNames dump: the upsert keys on geonames_id, so
 * existing rows update in place and new places are added. Nothing outside this file's table
 * changes, and check-in labels already stored are never rewritten.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const DUMP_URL = "https://download.geonames.org/export/dump/ZA.zip";
const ADMIN1_URL = "https://download.geonames.org/export/dump/admin1CodesASCII.txt";
const DEFAULT_OUT = "supabase/migrations/20260920001000_settlements_data.sql";
const BATCH = 400;

/** Feature codes that are not settlements a traveller would name: sections of a town, abandoned or destroyed places, historic names. */
const EXCLUDED_CODES = new Set(["PPLX", "PPLQ", "PPLW", "PPLH", "STLMT"]);
const ADMIN_SEAT_CODES = new Set(["PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4"]);

type Settlement = { geonamesId: number; name: string; asciiName: string; province: string | null; featureCode: string; population: number; latitude: number; longitude: number; tier: 1 | 2 | 3 };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Reads one entry from a ZIP archive (stored or deflated) without a zip dependency. */
function unzipEntry(zip: Buffer, entryName: string): Buffer {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 70_000); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file (no end-of-central-directory record)");
  const entries = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let n = 0; n < entries; n++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error("corrupt central directory");
    const method = zip.readUInt16LE(p + 10);
    const compressedSize = zip.readUInt32LE(p + 20);
    const nameLength = zip.readUInt16LE(p + 28);
    const extraLength = zip.readUInt16LE(p + 30);
    const commentLength = zip.readUInt16LE(p + 32);
    const localOffset = zip.readUInt32LE(p + 42);
    const name = zip.subarray(p + 46, p + 46 + nameLength).toString("utf8");
    if (name === entryName) {
      if (zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("corrupt local file header");
      const start = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
      const data = zip.subarray(start, start + compressedSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      throw new Error(`unsupported zip compression method ${method}`);
    }
    p += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`${entryName} not found in archive`);
}

function parseProvinces(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split("\n")) {
    const [code, name] = line.split("\t");
    if (code?.startsWith("ZA.")) map.set(code.slice(3), name);
  }
  return map;
}

/** GeoNames "geoname" table columns: id, name, asciiname, alternatenames, lat, lng, class, code, country, cc2, admin1..4, population, elevation, dem, tz, modified. */
export function parseSettlements(dump: string, provinces: Map<string, string>): Settlement[] {
  const out: Settlement[] = [];
  for (const line of dump.split("\n")) {
    if (!line) continue;
    const f = line.split("\t");
    if (f[6] !== "P" || EXCLUDED_CODES.has(f[7])) continue;
    const latitude = Number(f[4]);
    const longitude = Number(f[5]);
    const population = Math.max(0, Number(f[14]) || 0);
    const name = f[1].trim();
    if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const tier: 1 | 2 | 3 = ADMIN_SEAT_CODES.has(f[7]) || population >= 1000 ? 1 : population > 0 ? 2 : 3;
    out.push({ geonamesId: Number(f[0]), name, asciiName: f[2].trim() || name, province: provinces.get(f[10]) ?? null, featureCode: f[7], population, latitude, longitude, tier });
  }
  return out.sort((a, b) => a.geonamesId - b.geonamesId);
}

const q = (s: string | null) => (s == null ? "null" : `'${s.replace(/'/g, "''")}'`);

export function renderMigration(rows: Settlement[], fetchedAt: string): string {
  const lines: string[] = [
    "-- GENERATED FILE · do not edit by hand. Rebuild with: npx tsx scripts/build-settlements.ts",
    `-- Source: GeoNames gazetteer, ${DUMP_URL} (fetched ${fetchedAt}).`,
    "-- Licence: Creative Commons Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/). Attribution: \"Place names © GeoNames\".",
    `-- Populated places of South Africa (feature class P) excluding town sections, abandoned and historic places: ${rows.length} rows.`,
    "-- Requires 20260920000900_settlements.sql (table and functions).",
    "",
  ];
  for (let i = 0; i < rows.length; i += BATCH) {
    lines.push("insert into public.settlements (geonames_id, name, ascii_name, province, feature_code, population, latitude, longitude, tier) values");
    const values = rows.slice(i, i + BATCH).map((r) => `(${r.geonamesId}, ${q(r.name)}, ${q(r.asciiName)}, ${q(r.province)}, ${q(r.featureCode)}, ${r.population}, ${r.latitude}, ${r.longitude}, ${r.tier})`);
    lines.push(values.join(",\n"));
    lines.push("on conflict (geonames_id) do update set name = excluded.name, ascii_name = excluded.ascii_name, province = excluded.province, feature_code = excluded.feature_code, population = excluded.population, latitude = excluded.latitude, longitude = excluded.longitude, tier = excluded.tier;");
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const zipPath = arg("zip");
  const out = arg("out") ?? DEFAULT_OUT;
  const zip = zipPath ? readFileSync(zipPath) : await download(DUMP_URL);
  const dump = unzipEntry(zip, "ZA.txt").toString("utf8");
  const provinces = parseProvinces((await download(ADMIN1_URL)).toString("utf8"));
  const rows = parseSettlements(dump, provinces);
  if (rows.length < 5000) throw new Error(`only ${rows.length} settlements parsed; refusing to write a thin gazetteer`);
  writeFileSync(out, renderMigration(rows, new Date().toISOString().slice(0, 10)));
  const tiers = rows.reduce((acc, r) => ({ ...acc, [r.tier]: (acc[r.tier] ?? 0) + 1 }), {} as Record<number, number>);
  console.log(`Wrote ${rows.length} settlements (towns ${tiers[1] ?? 0}, villages ${tiers[2] ?? 0}, hamlets ${tiers[3] ?? 0}) to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
