#!/usr/bin/env node
/**
 * Copy section phaseTransitions to stateTransitions using Application Default
 * Credentials. New field names win when both names exist. Targets are replaced,
 * never merged; unchanged targets are skipped. Legacy rows are deleted only
 * after the copy pass and only when their target exists.
 *
 *   gcloud auth application-default login
 *   node scripts/migrate-phase-transitions.mjs --project <id> --dry-run
 *   node scripts/migrate-phase-transitions.mjs --project <id>
 *   node scripts/migrate-phase-transitions.mjs --project <id> --drop-legacy
 *
 * For emulator verification, set FIRESTORE_EMULATOR_HOST=127.0.0.1:8052.
 */

import { isDeepStrictEqual } from "node:util";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const MAX_BATCH = 400;

function parseArgs(argv) {
	const args = { project: null, dryRun: false, dropLegacy: false };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--project" && argv[i + 1]?.startsWith("--") !== true)
			args.project = argv[++i] ?? null;
		else if (argv[i] === "--dry-run") args.dryRun = true;
		else if (argv[i] === "--drop-legacy") args.dropLegacy = true;
		else if (argv[i] === "--help" || argv[i] === "-h") args.help = true;
		else throw new Error(`Unknown argument: ${argv[i]}`);
	}
	return args;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help || !args.project) {
		if (!args.help) console.error("Missing required --project <id>");
		console.log(
			"Usage: node scripts/migrate-phase-transitions.mjs --project <id> [--dry-run] [--drop-legacy]",
		);
		if (!args.help) process.exitCode = 1;
		return;
	}

	console.log(
		`Project: ${args.project}${args.dryRun ? " (dry run — nothing is written or deleted)" : ""}`,
	);
	initializeApp({
		credential: applicationDefault(),
		projectId: args.project,
	});
	const db = getFirestore();
	const sections = await db.collectionGroup("sections").get();
	const rows = [];
	const toWrite = [];
	let scanned = 0;
	let mapped = 0;
	for (const section of sections.docs) {
		if (
			!/^users\/[^/]+\/pieces\/[^/]+\/sections\/[^/]+$/.test(section.ref.path)
		)
			continue;
		scanned++;
		const source = await section.ref.collection("phaseTransitions").get();
		for (const doc of source.docs) {
			const data = doc.data();
			let changed = false;
			for (const [oldName, newName] of [
				["fromPhase", "fromState"],
				["toPhase", "toState"],
				["daysInPriorPhase", "daysInPriorState"],
			]) {
				if (Object.hasOwn(data, oldName)) {
					if (!Object.hasOwn(data, newName)) data[newName] = data[oldName];
					delete data[oldName];
					changed = true;
				}
			}
			if (data.trigger === "phase-chip") {
				data.trigger = "state-chip";
				changed = true;
			}
			if (changed) mapped++;
			const ref = section.ref.collection("stateTransitions").doc(doc.id);
			const target = await ref.get();
			rows.push({ source: doc.ref, target: ref });
			if (!target.exists || !isDeepStrictEqual(target.data(), data))
				toWrite.push({ ref, data });
		}
	}

	let written = 0;
	for (let i = 0; i < toWrite.length; i += MAX_BATCH) {
		const chunk = toWrite.slice(i, i + MAX_BATCH);
		if (args.dryRun) {
			for (const { ref } of chunk) console.log(`  would set ${ref.path}`);
		} else {
			const batch = db.batch();
			for (const { ref, data } of chunk) batch.set(ref, data);
			await batch.commit();
			written += chunk.length;
		}
	}

	let dropped = 0;
	if (args.dropLegacy) {
		for (let i = 0; i < rows.length; i += MAX_BATCH) {
			const chunk = rows.slice(i, i + MAX_BATCH);
			const targets = await db.getAll(...chunk.map((row) => row.target));
			const batch = db.batch();
			let pending = 0;
			for (let j = 0; j < chunk.length; j++) {
				if (args.dryRun) {
					console.log(`  would drop after copy ${chunk[j].source.path}`);
				} else if (targets[j].exists) {
					batch.delete(chunk[j].source);
					pending++;
				}
			}
			if (pending > 0) {
				await batch.commit();
				dropped += pending;
			}
		}
	}

	console.log(
		`${scanned} sections scanned · ${rows.length} rows found · ${mapped} rows mapped · ${rows.length - mapped} rows already new-shape · ${written} rows written · ${dropped} rows dropped · ${toWrite.length} changed`,
	);
	if (args.dryRun) console.log("Dry run — no documents were modified.");
	const remaining = await db.collectionGroup("phaseTransitions").count().get();
	console.log(`${remaining.data().count} phaseTransitions rows remaining`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
