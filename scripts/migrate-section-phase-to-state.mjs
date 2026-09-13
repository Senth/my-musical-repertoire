#!/usr/bin/env node
/**
 * Renames `phase` to `state` on section documents (#84).
 *
 * The app now reads `state` with a `phase` fallback and writes only `state`,
 * so this script can run before, during, or after an app release — the
 * dual-read keeps old and new documents working either way. Until `phase`
 * is dropped, documents carry both fields with identical values.
 *
 * Idempotent: documents that already have `state` are skipped, and
 * `--drop-legacy` only touches documents that still carry `phase`. Run it
 * with `--drop-legacy` once every client has been on the new build for a
 * release cycle.
 *
 * Auth uses Application Default Credentials, and the Admin SDK bypasses
 * Firestore rules, so no rules deploy is needed.
 *
 *   gcloud auth application-default login
 *   node scripts/migrate-section-phase-to-state.mjs --project my-musical-repertoire-dev --dry-run
 *   node scripts/migrate-section-phase-to-state.mjs --project my-musical-repertoire-dev
 *   # once the rollout is complete, only with explicit confirmation:
 *   node scripts/migrate-section-phase-to-state.mjs --project my-musical-repertoire --dry-run --drop-legacy
 *   node scripts/migrate-section-phase-to-state.mjs --project my-musical-repertoire --drop-legacy
 */

import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const MAX_BATCH = 400;

function parseArgs(argv) {
	const args = { project: null, dryRun: false, dropLegacy: false };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--project") args.project = argv[++i] ?? null;
		else if (argv[i] === "--dry-run") args.dryRun = true;
		else if (argv[i] === "--drop-legacy") args.dropLegacy = true;
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
		"Usage: node scripts/migrate-section-phase-to-state.mjs --project <id> [--dry-run] [--drop-legacy]",
	);
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
		`Project: ${args.project}${args.dryRun ? " (dry run — nothing is written)" : ""}${args.dropLegacy ? " (dropping legacy phase)" : ""}`,
	);

	initializeApp({
		credential: applicationDefault(),
		projectId: args.project,
	});
	const db = getFirestore();

	const snap = await db.collectionGroup("sections").get();
	const toWrite = [];
	const toDrop = [];
	let alreadyMigrated = 0;

	for (const doc of snap.docs) {
		const data = doc.data();
		if (data.state != null) {
			alreadyMigrated++;
			if (args.dropLegacy && data.phase != null) toDrop.push(doc.ref);
			continue;
		}
		if (data.phase == null) {
			console.warn(`  ! ${doc.path} has neither phase nor state — skipping`);
			continue;
		}
		toWrite.push({ ref: doc.ref, phase: data.phase });
	}

	let written = 0;
	for (let i = 0; i < toWrite.length; i += MAX_BATCH) {
		const chunk = toWrite.slice(i, i + MAX_BATCH);
		if (args.dryRun) {
			for (const { ref, phase } of chunk) {
				console.log(`  would set ${ref.path} → state: ${phase}`);
			}
		} else {
			const batch = db.batch();
			for (const { ref, phase } of chunk)
				batch.set(ref, { state: phase }, { merge: true });
			await batch.commit();
			written += chunk.length;
			console.log(`  committed ${written}/${toWrite.length}`);
		}
	}

	let dropped = 0;
	for (let i = 0; i < toDrop.length; i += MAX_BATCH) {
		const chunk = toDrop.slice(i, i + MAX_BATCH);
		if (args.dryRun) {
			for (const ref of chunk) console.log(`  would drop phase on ${ref.path}`);
		} else {
			const batch = db.batch();
			for (const ref of chunk)
				batch.update(ref, { phase: FieldValue.delete() });
			await batch.commit();
			dropped += chunk.length;
			console.log(`  dropped legacy phase on ${dropped}/${toDrop.length}`);
		}
	}

	console.log(
		`\n${snap.size} sections found · ${toWrite.length} to migrate · ${toDrop.length} legacy drops · ${alreadyMigrated} already on state`,
	);
	if (args.dryRun) console.log("Dry run — no documents were modified.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
