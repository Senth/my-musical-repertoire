#!/usr/bin/env node
/**
 * Copies `phase` to `state` and `phaseChangedAt` to `stateChangedAt` on
 * section documents (#84).
 *
 * The script only adds fields, so a deployed old build keeps working while it
 * runs. The new build reads either name, so it works before the deploy too.
 * Until the legacy names are dropped, a migrated document carries both.
 *
 * The rollout this was written for:
 *
 *   1. run it against production before the PR is merged
 *   2. merge, which deploys hosting
 *   3. run it again, to catch sections a browser tab on the old build wrote
 *      during the deploy window
 *   4. `--drop-legacy`, in the follow-up issue, once every client has been on
 *      the new build for a release cycle
 *
 * Idempotent: a field already present on the target name is left alone, and
 * `--drop-legacy` only touches documents that still carry a legacy name.
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
		`Project: ${args.project}${args.dryRun ? " (dry run — nothing is written)" : ""}${args.dropLegacy ? " (dropping the legacy field names)" : ""}`,
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
		const update = {};
		if (data.state == null && data.phase != null) update.state = data.phase;
		if (data.stateChangedAt == null && data.phaseChangedAt != null)
			update.stateChangedAt = data.phaseChangedAt;

		if (Object.keys(update).length > 0) toWrite.push({ ref: doc.ref, update });
		else alreadyMigrated++;

		if (data.state == null && data.phase == null)
			console.warn(`  ! ${doc.path} has neither phase nor state — skipping`);

		if (args.dropLegacy && (data.phase != null || data.phaseChangedAt != null))
			toDrop.push(doc.ref);
	}

	let written = 0;
	for (let i = 0; i < toWrite.length; i += MAX_BATCH) {
		const chunk = toWrite.slice(i, i + MAX_BATCH);
		if (args.dryRun) {
			for (const { ref, update } of chunk) {
				console.log(`  would set ${ref.path} → ${JSON.stringify(update)}`);
			}
		} else {
			const batch = db.batch();
			for (const { ref, update } of chunk)
				batch.set(ref, update, { merge: true });
			await batch.commit();
			written += chunk.length;
			console.log(`  committed ${written}/${toWrite.length}`);
		}
	}

	let dropped = 0;
	for (let i = 0; i < toDrop.length; i += MAX_BATCH) {
		const chunk = toDrop.slice(i, i + MAX_BATCH);
		if (args.dryRun) {
			for (const ref of chunk)
				console.log(`  would drop phase and phaseChangedAt on ${ref.path}`);
		} else {
			const batch = db.batch();
			for (const ref of chunk)
				batch.update(ref, {
					phase: FieldValue.delete(),
					phaseChangedAt: FieldValue.delete(),
				});
			await batch.commit();
			dropped += chunk.length;
			console.log(`  dropped legacy fields on ${dropped}/${toDrop.length}`);
		}
	}

	console.log(
		`\n${snap.size} sections found · ${toWrite.length} to migrate · ${toDrop.length} legacy drops · ${alreadyMigrated} already migrated`,
	);
	if (args.dryRun) console.log("Dry run — no documents were modified.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
