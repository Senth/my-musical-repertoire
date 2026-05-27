import { Platform } from "react-native";

export function playBlockEndCue(): void {
	if (Platform.OS !== "web" || typeof window === "undefined") {
		return;
	}
	try {
		const w = window as unknown as {
			AudioContext?: typeof AudioContext;
			webkitAudioContext?: typeof AudioContext;
		};
		const Ctor = w.AudioContext ?? w.webkitAudioContext;
		if (!Ctor) return;
		const ctx = new Ctor();
		const now = ctx.currentTime;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "sine";
		osc.frequency.setValueAtTime(660, now);
		osc.frequency.exponentialRampToValueAtTime(440, now + 0.4);
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.exponentialRampToValueAtTime(0.25, now + 0.03);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(now);
		osc.stop(now + 0.65);
		setTimeout(() => {
			ctx.close().catch(() => {});
		}, 800);
	} catch {
		// Ignore audio errors
	}
}
