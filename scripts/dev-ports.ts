import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const FIRST_PORT = 7000;
const PORT_COUNT = 1000;
const CLAIM_GRACE_MS = 3_000;
const LOCK_STALE_MS = 5_000;

export type DevStack = {
	web: number;
	mongo?: number;
	pid: number;
	start?: string;
	mongoPid?: number;
	mongoStart?: string;
};

function registryDir() {
	return path.resolve(
		process.env.DEV_STACK_REGISTRY ??
			path.join(os.homedir(), ".local/state/dev-ports"),
	);
}

function stackFile() {
	return path.join(process.cwd(), ".tmp/dev-stack/stack.json");
}

function worktreeRoot() {
	return execFileSync("git", ["rev-parse", "--show-toplevel"], {
		encoding: "utf8",
	}).trim();
}

export function scanStart(root: string) {
	return (
		FIRST_PORT +
		(createHash("sha256").update(root).digest().readUInt32BE(0) % PORT_COUNT)
	);
}

function listenFree(port: number, host: string) {
	return new Promise<boolean | undefined>((resolve) => {
		const probe = net.createServer();
		probe.once("error", (error: NodeJS.ErrnoException) =>
			resolve(
				error.code === "EAFNOSUPPORT" || error.code === "EADDRNOTAVAIL"
					? undefined
					: false,
			),
		);
		probe.once("listening", () => probe.close(() => resolve(true)));
		probe.listen(port, host);
	});
}

async function portFree(port: number) {
	return (
		(await listenFree(port, "::")) ??
		(await listenFree(port, "0.0.0.0")) ??
		false
	);
}

function claimPid(dir: string) {
	try {
		return Number.parseInt(fs.readFileSync(path.join(dir, "pid"), "utf8"), 10);
	} catch {
		return 0;
	}
}

function pidAlive(pid: number) {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

function procStart(pid: number) {
	try {
		return fs
			.readFileSync(`/proc/${pid}/stat`, "utf8")
			.split(") ")
			.pop()
			?.split(" ")[19];
	} catch {
		return undefined;
	}
}

function claimLive(dir: string) {
	const pid = claimPid(dir);
	if (pid > 0) return pidAlive(pid);
	try {
		return Date.now() - fs.statSync(dir).mtimeMs < CLAIM_GRACE_MS;
	} catch {
		return false;
	}
}

function alive(pid: number | undefined, start: string | undefined) {
	return (
		pid !== undefined &&
		pidAlive(pid) &&
		(procStart(pid) ?? "") === (start ?? "")
	);
}

const lockOwner = () => `${process.pid} ${procStart(process.pid) ?? ""}`;

function createExclusive(file: string) {
	const temp = `${file}.${randomUUID()}`;
	fs.writeFileSync(temp, lockOwner());
	try {
		fs.linkSync(temp, file);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
		throw error;
	} finally {
		fs.rmSync(temp, { force: true });
	}
}

function lockStale(file: string) {
	try {
		const [pid, start] = fs.readFileSync(file, "utf8").split(" ");
		return (
			!alive(Number(pid), start) ||
			Date.now() - fs.statSync(file).mtimeMs > LOCK_STALE_MS
		);
	} catch {
		return false;
	}
}

function lockHeld(file: string) {
	try {
		return fs.readFileSync(file, "utf8") === lockOwner();
	} catch {
		return false;
	}
}

export async function withLock<T>(fn: () => T) {
	const lock = path.join(registryDir(), ".lock");
	const breaker = `${lock}.break`;
	fs.mkdirSync(registryDir(), { recursive: true });
	while (!createExclusive(lock)) {
		if (lockStale(lock) && createExclusive(breaker)) {
			try {
				if (lockStale(lock)) fs.rmSync(lock, { force: true });
			} finally {
				fs.rmSync(breaker, { force: true });
			}
		} else if (lockStale(breaker)) {
			fs.rmSync(breaker, { force: true });
		} else {
			await sleep(10);
		}
	}
	try {
		return fn();
	} finally {
		if (lockHeld(lock)) fs.rmSync(lock);
	}
}

async function claimPort(
	port: number,
	pid: number,
	root: string,
	lease: string,
) {
	if (!(await portFree(port))) return false;
	const dir = path.join(registryDir(), String(port));
	return withLock(() => {
		if (fs.existsSync(dir)) {
			if (claimLive(dir)) return false;
			fs.rmSync(dir, { recursive: true, force: true });
		}
		try {
			fs.mkdirSync(dir);
			if (pid > 0) fs.writeFileSync(path.join(dir, "pid"), String(pid));
			fs.writeFileSync(path.join(dir, "worktree"), root);
			fs.writeFileSync(path.join(dir, "lease"), lease);
			return true;
		} catch {
			return false;
		}
	});
}

export async function allocPorts(
	names: string[],
	pid: number,
	root = worktreeRoot(),
	lease: string,
) {
	if (!lease) throw new Error("missing allocation lease");
	const pending = [...names];
	const ports: Record<string, number> = {};
	const offset = scanStart(root) - FIRST_PORT;
	for (let i = 0; i < PORT_COUNT && pending.length > 0; i++) {
		const port = FIRST_PORT + ((offset + i) % PORT_COUNT);
		if (await claimPort(port, pid, root, lease))
			ports[pending.shift() as string] = port;
	}
	if (pending.length > 0) {
		await releasePorts(ports, pid, lease);
		throw new Error(
			`no free ports in ${FIRST_PORT}-${FIRST_PORT + PORT_COUNT - 1} for: ${pending.join(" ")}`,
		);
	}
	return ports;
}

export function portArg(args: string[]) {
	const i = args.findIndex((arg) => /^(-p|--port)(=|$)/.test(arg));
	return i < 0 ? undefined : Number(args[i]?.split("=")[1] ?? args[i + 1]);
}

function assertPort(port: number) {
	if (
		!Number.isInteger(port) ||
		port < FIRST_PORT ||
		port >= FIRST_PORT + PORT_COUNT
	) {
		throw new Error(`invalid port: ${port}`);
	}
}

function matchingLease(dir: string, lease: string) {
	try {
		return (
			!!lease && fs.readFileSync(path.join(dir, "lease"), "utf8") === lease
		);
	} catch {
		return false;
	}
}

export async function ownPorts(pid: number, ports: number[], lease: string) {
	if (!Number.isInteger(pid) || pid <= 0)
		throw new Error(`invalid pid: ${pid}`);
	for (const port of ports) assertPort(port);
	await withLock(() => {
		for (const port of ports) {
			const dir = path.join(registryDir(), String(port));
			const owner = claimPid(dir);
			if (!matchingLease(dir, lease) || (owner > 0 && owner !== pid)) {
				throw new Error(`port ${port} is not an unowned claim`);
			}
		}
		for (const port of ports) {
			fs.writeFileSync(
				path.join(registryDir(), String(port), "pid"),
				String(pid),
			);
		}
	});
}

export async function releasePorts(
	ports: Record<string, number>,
	pid: number,
	lease: string,
) {
	for (const port of Object.values(ports)) assertPort(port);
	const errors = await withLock(() =>
		Object.values(ports).flatMap((port) => {
			const dir = path.join(registryDir(), String(port));
			try {
				const owner = claimPid(dir);
				if (matchingLease(dir, lease) && (owner === pid || !pidAlive(owner)))
					fs.rmSync(dir, { recursive: true, force: true });
				return [];
			} catch (error) {
				return [error];
			}
		}),
	);
	if (errors.length > 0)
		throw new AggregateError(
			errors,
			`could not release ${errors.length} port claim(s)`,
		);
}

export function writeStack(state: DevStack) {
	fs.mkdirSync(path.dirname(stackFile()), { recursive: true });
	const mongoStart =
		state.mongoPid === undefined ? undefined : procStart(state.mongoPid);
	fs.writeFileSync(
		stackFile(),
		JSON.stringify({ ...state, start: procStart(state.pid), mongoStart }),
	);
}

export function readStack(): DevStack | undefined {
	let state: DevStack;
	try {
		state = JSON.parse(fs.readFileSync(stackFile(), "utf8"));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
	if (!alive(state.pid, state.start)) return undefined;
	return alive(state.mongoPid, state.mongoStart)
		? state
		: { ...state, mongo: undefined };
}

export function clearStack(pid: number) {
	if (readStack()?.pid === pid) fs.rmSync(stackFile(), { force: true });
}

async function runCli(args: string[]) {
	const [command, ...values] = args;
	if (command === "alloc" && values.length > 0) {
		const lease = randomUUID();
		const ports = await allocPorts(values, 0, worktreeRoot(), lease);
		process.stdout.write(`${JSON.stringify({ lease, ports })}\n`);
		return;
	}
	if (command === "own" && values.length > 2) {
		const [lease, pid, ...ports] = values;
		await ownPorts(Number(pid), ports.map(Number), lease as string);
		return;
	}
	if (command === "release" && values.length > 1) {
		const [lease, ...numbers] = values;
		const ports = numbers.map(Number);
		await releasePorts(
			Object.fromEntries(ports.map((port) => [String(port), port])),
			process.ppid,
			lease as string,
		);
		return;
	}
	throw new Error(
		"usage: node scripts/dev-ports.ts alloc <name>... | own <lease> <pid> <port>... | release <lease> <port>...",
	);
}

if (
	process.argv[1]?.endsWith("scripts/dev-ports.ts") ||
	process.argv[1] === "scripts/dev-ports.ts"
) {
	void runCli(process.argv.slice(2)).catch((error: unknown) => {
		process.stderr.write(
			`${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 1;
	});
}
