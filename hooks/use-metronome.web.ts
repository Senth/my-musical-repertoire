import { useCallback, useEffect, useRef, useState } from "react";

export interface UseMetronomeReturn {
	isRunning: boolean;
	toggle: () => void;
	stop: () => void;
}

const SCHEDULER_INTERVAL_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;
const CLICK_FREQ_HZ = 880;
const CLICK_DUR_S = 0.03;
const CLICK_GAIN_PEAK = 4.0; // above 1.0 is safe — DynamicsCompressorNode prevents hard clipping

export function useMetronome(bpm: number): UseMetronomeReturn {
	const [isRunning, setIsRunning] = useState(false);
	const audioCtxRef = useRef<AudioContext | null>(null);
	const compressorRef = useRef<DynamicsCompressorNode | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const nextNoteTimeRef = useRef(0);
	const bpmRef = useRef(bpm);

	useEffect(() => {
		bpmRef.current = bpm;
	}, [bpm]);

	const scheduleClick = useCallback((time: number) => {
		const ctx = audioCtxRef.current;
		if (!ctx) return;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "triangle";
		osc.frequency.value = CLICK_FREQ_HZ;
		gain.gain.setValueAtTime(0.0001, time);
		gain.gain.exponentialRampToValueAtTime(CLICK_GAIN_PEAK, time + 0.002);
		gain.gain.exponentialRampToValueAtTime(0.0001, time + CLICK_DUR_S);
		osc.connect(gain);
		gain.connect(compressorRef.current ?? ctx.destination);
		osc.start(time);
		osc.stop(time + CLICK_DUR_S);
	}, []);

	const scheduler = useCallback(() => {
		const ctx = audioCtxRef.current;
		if (!ctx) return;
		while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_S) {
			scheduleClick(nextNoteTimeRef.current);
			const interval = 60 / Math.max(1, bpmRef.current);
			nextNoteTimeRef.current += interval;
		}
	}, [scheduleClick]);

	const stop = useCallback(() => {
		if (intervalRef.current != null) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		const ctx = audioCtxRef.current;
		if (ctx && ctx.state === "running") {
			void ctx.suspend();
		}
		setIsRunning(false);
	}, []);

	const toggle = useCallback(() => {
		if (intervalRef.current != null) {
			stop();
			return;
		}
		if (!audioCtxRef.current) {
			const Ctor =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext;
			audioCtxRef.current = new Ctor();
			const compressor = audioCtxRef.current.createDynamicsCompressor();
			compressor.threshold.value = -24;
			compressor.knee.value = 0;
			compressor.ratio.value = 12;
			compressor.attack.value = 0.003;
			compressor.release.value = 0.25;
			compressor.connect(audioCtxRef.current.destination);
			compressorRef.current = compressor;
		}
		const ctx = audioCtxRef.current;
		if (!ctx) return;
		if (ctx.state === "suspended") {
			void ctx.resume();
		}
		nextNoteTimeRef.current = ctx.currentTime + 0.05;
		intervalRef.current = setInterval(scheduler, SCHEDULER_INTERVAL_MS);
		setIsRunning(true);
	}, [scheduler, stop]);

	useEffect(() => {
		return () => {
			if (intervalRef.current != null) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			const ctx = audioCtxRef.current;
			if (ctx) {
				void ctx.close();
				audioCtxRef.current = null;
				compressorRef.current = null;
			}
		};
	}, []);

	return { isRunning, toggle, stop };
}
