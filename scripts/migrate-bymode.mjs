#!/usr/bin/env node
/**
 * Backfills `byMode` on sections and techniques.
 *
 * Which mode an untagged practice belongs to depends on what was practised:
 *
 *   sections    → `HT`. Section and whole-piece practice was hands together.
 *   techniques  → `LH` + `RH`, because techniques are hands-separate by
 *                 default. Writing `HT` would both claim a hands-together
 *                 tempo the student never played and strand the value on a
 *                 mode the chips do not even offer. A technique explicitly
 *                 marked `handsMode: "together"` gets `HT` instead.
 *
 * Documents that already have a non-empty `byMode`, or that have never been
 * practised, are left alone. The script is idempotent, and it never touches
 * the legacy fields it reads from.
 *
 * Auth uses Application Default Credentials, and the Admin SDK bypasses
 * Firestore rules, so no rules deploy is needed.
 *
 *   gcloud auth application-default login
 *   node scripts/migrate-bymode.mjs --project my-musical-repertoire-dev --dry-run
 *   node scripts/migrate-bymode.mjs --project my-musical-repertoire-dev
 *   # verify in the app, then — only with explicit confirmation:
 *   node scripts/migrate-bymode.mjs --project my-musical-repertoire --dry-run
 *   node scripts/migrate-bymode.mjs --project my-musical-repertoire
 */

import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const MAX_BATCH = 400;

function parseArgs(argv) {
	const args = { project: null, dryRun: false };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--project") args.project = argv[++i] ?? null;
		else if (argv[i] === "--dry-run") args.dryRun = true;
		else if (argv[i] === "--help" || argv[i] === "-h") args.help = true;
		else {
			console.error(`Unknown argument: ${argv[i]}`);
			process.exit(1);
		}
	}
	return args;
}

function usage() {
	console.log(
		"Usage: node scripts/migrate-bymode.mjs --project <id> [--dry-run]",
	);
}

/**
 * Which `byMode` keys an untagged practice becomes. Sections are always hands
 * together; techniques are hands-separate unless the user said otherwise, so
 * the same tempo lands on both hands.
 */
function targetModeKeys(group, data) {
	if (group === "sections") return ["HT"];
	return (data.handsMode ?? "separate") === "together" ? ["HT"] : ["LH", "RH"];
}

/**
 * `users/{uid}` parent documents do not exist, so a `users` listing returns
 * nothing — collection group queries are the only way to reach these.
 */
async function migrateCollection(db, { group, bpmField, practicedField }) {
	const snap = await db.collectionGroup(group).get();
	const pending = [];
	let skippedExisting = 0;
	let skippedUnpractised = 0;

	for (const doc of snap.docs) {
		const data = doc.data();
		if (data.byMode && Object.keys(data.byMode).length > 0) {
			skippedExisting++;
			continue;
		}
		const bpm = data[bpmField] ?? null;
		if (bpm == null) {
			skippedUnpractised++;
			continue;
		}
		const stats = {
			bpm,
			quality: data.lastQuality ?? null,
			effort: data.lastEffort ?? null,
			lastPracticed: data[practicedField] ?? null,
		};
		const byMode = {};
		for (const key of targetModeKeys(group, data)) byMode[key] = { ...stats };
		pending.push({ ref: doc.ref, byMode });
	}

	return { snap, pending, skippedExisting, skippedUnpractised };
}

async function commit(db, pending, dryRun) {
	if (dryRun) {
		for (const { ref, byMode } of pending) {
			const keys = Object.keys(byMode);
			console.log(
				`  would set ${ref.path} → ${keys.map((k) => `byMode.${k}`).join(" + ")}`,
				byMode[keys[0]],
			);
		}
		return 0;
	}

	let written = 0;
	for (let i = 0; i < pending.length; i += MAX_BATCH) {
		const chunk = pending.slice(i, i + MAX_BATCH);
		const batch = db.batch();
		for (const { ref, byMode } of chunk) {
			batch.set(ref, { byMode }, { merge: true });
		}
		await batch.commit();
		written += chunk.length;
		console.log(`  committed ${written}/${pending.length}`);
	}
	return written;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		usage();
		return;
	}
	if (!args.project) {
		console.error("Missing required --project <id>");
		usage();
		process.exit(1);
	}

	console.log(
		`Project: ${args.project}${args.dryRun ? " (dry run — nothing is written)" : ""}`,
	);

	initializeApp({
		credential: applicationDefault(),
		projectId: args.project,
	});
	const db = getFirestore();

	const targets = [
		{
			group: "sections",
			bpmField: "currentBpm",
			practicedField: "lastPracticed",
		},
		{
			group: "techniques",
			bpmField: "lastAchievedTempoBpm",
			practicedField: "lastPracticedAt",
		},
	];

	const summary = [];
	for (const target of targets) {
		console.log(`\nScanning ${target.group}…`);
		const result = await migrateCollection(db, target);
		console.log(
			`  ${result.snap.size} found · ${result.pending.length} to migrate · ` +
				`${result.skippedExisting} already have byMode · ` +
				`${result.skippedUnpractised} never practised`,
		);
		const written = await commit(db, result.pending, args.dryRun);
		summary.push({
			collection: target.group,
			scanned: result.snap.size,
			migrated: args.dryRun ? 0 : written,
			planned: result.pending.length,
			skippedExisting: result.skippedExisting,
			skippedUnpractised: result.skippedUnpractised,
		});
	}

	console.log("\nSummary");
	console.table(summary);
	if (args.dryRun) console.log("Dry run — no documents were modified.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
