import { getColor, getColorScale } from '../utils/styling';
import { describe, expect, test } from 'vitest';

import type { RenderableColorScale } from '../types';

const scale: RenderableColorScale = {
	type: 'breakpoint',
	unit: '°C',
	breakpoints: [0, 10, 20],
	colors: [
		[0, 0, 0, 1],
		[100, 0, 0, 1],
		[200, 0, 0, 1]
	]
};

describe('getColor', () => {
	test('non-blend returns the scale colour for the band', () => {
		expect(getColor(scale, 15, false)).toEqual([100, 0, 0, 1]);
	});

	// Band centres: 5, 15 and 25 (the open last band mirrors the previous width)
	test('blend keeps the hard colour at band centres', () => {
		expect(getColor(scale, 5, true)).toEqual([0, 0, 0, 1]);
		expect(getColor(scale, 15, true)).toEqual([100, 0, 0, 1]);
		expect(getColor(scale, 25, true)).toEqual([200, 0, 0, 1]);
	});

	test('blend is halfway between neighbouring colours at a breakpoint', () => {
		expect(getColor(scale, 10, true)).toEqual([50, 0, 0, 1]);
		expect(getColor(scale, 20, true)).toEqual([150, 0, 0, 1]);
	});

	test('blend keeps the outer colours beyond the outermost centres', () => {
		expect(getColor(scale, -100, true)).toEqual([0, 0, 0, 1]);
		expect(getColor(scale, 2, true)).toEqual([0, 0, 0, 1]);
		expect(getColor(scale, 100, true)).toEqual([200, 0, 0, 1]);
	});

	test('blend leaves values below the first visible precipitation band transparent', () => {
		const precipitation = getColorScale('precipitation', false);
		// first band 0.01–0.055 mm/h is transparent in hard mode
		for (const px of [0, 0.01, 0.02, 0.03, 0.05, 0.0549]) {
			expect(getColor(precipitation, px, true)[3]).toBe(0);
		}
		// fades in only above the breakpoint, reaching band 1 at its centre
		expect(getColor(precipitation, 0.06, true)[3]).toBeGreaterThan(0);
		expect(getColor(precipitation, 0.06, true)[3]).toBeLessThan(0.4);
	});

	test('blend fades next to a transparent band only on the visible side', () => {
		const s: RenderableColorScale = {
			type: 'breakpoint',
			unit: '',
			breakpoints: [0, 10, 20, 30],
			colors: [
				[0, 0, 0, 1],
				[0, 0, 0, 0],
				[100, 0, 0, 1],
				[200, 0, 0, 1]
			]
		};
		// band 1 [10, 20) stays fully transparent
		for (const px of [10, 12, 15, 19.9]) expect(getColor(s, px, true)[3]).toBe(0);
		// band 0 fades out from its centre 5 up to the edge at 10
		expect(getColor(s, 7.5, true)[3]).toBe(0.5);
		// band 2 fades in from the edge at 20 up to its centre 25
		expect(getColor(s, 22.5, true)[3]).toBe(0.5);
		// the edge between two visible bands stays centred
		expect(getColor(s, 30, true)).toEqual([150, 0, 0, 1]);
	});

	test('blend matches hard colours at every band centre', () => {
		for (const name of ['precipitation', 'temperature', 'pressure']) {
			const s = getColorScale(name, false);
			if (s.type !== 'breakpoint') throw new Error(`expected breakpoint scale for ${name}`);
			const bp = s.breakpoints;
			for (let i = 0; i < bp.length - 1; i++) {
				const centre = (bp[i] + bp[i + 1]) / 2;
				const blended = getColor(s, centre, true);
				const hard = getColor(s, centre, false);
				hard.forEach((c, k) => expect(blended[k]).toBeCloseTo(c, 9));
			}
		}
	});

	test('blend is continuous across breakpoints', () => {
		const s = getColorScale('precipitation', false);
		if (s.type !== 'breakpoint') throw new Error('expected breakpoint scale');
		for (const b of s.breakpoints) {
			const below = getColor(s, b - 1e-9, true);
			const above = getColor(s, b + 1e-9, true);
			below.forEach((c, k) => expect(above[k]).toBeCloseTo(c, 4));
		}
	});

	test('blend fills and returns the provided out buffer (no per-call allocation)', () => {
		const out: [number, number, number, number] = [0, 0, 0, 0];
		const result = getColor(scale, 10, true, out);
		expect(result).toBe(out); // same reference => reused, not freshly allocated
		expect(out).toEqual([50, 0, 0, 1]);
	});

	test('the out buffer is reused (overwritten) across calls', () => {
		const out: [number, number, number, number] = [0, 0, 0, 0];
		expect(getColor(scale, 7.5, true, out)).toBe(out); // t=0.25 -> [25,0,0,1]
		expect(getColor(scale, 17.5, true, out)).toBe(out); // t=0.25 -> [125,0,0,1]
		expect(out).toEqual([125, 0, 0, 1]);
	});
});

describe('getColor rgba', () => {
	// Cells [0,10), [10,20), [20,30) with centres 5, 15, 25
	const rgba: RenderableColorScale = {
		type: 'rgba',
		unit: '',
		min: 0,
		max: 30,
		colors: [
			[0, 0, 0, 1],
			[100, 0, 0, 1],
			[200, 0, 0, 1]
		]
	};

	test('non-blend returns the cell colour', () => {
		expect(getColor(rgba, 12, false)).toEqual([100, 0, 0, 1]);
	});

	test('blend keeps the cell colour at cell centres', () => {
		expect(getColor(rgba, 5, true)).toEqual([0, 0, 0, 1]);
		expect(getColor(rgba, 15, true)).toEqual([100, 0, 0, 1]);
		expect(getColor(rgba, 25, true)).toEqual([200, 0, 0, 1]);
	});

	test('blend is halfway at a cell boundary', () => {
		expect(getColor(rgba, 10, true)).toEqual([50, 0, 0, 1]);
	});

	test('blend keeps the outer colours beyond the outermost centres', () => {
		expect(getColor(rgba, -5, true)).toEqual([0, 0, 0, 1]);
		expect(getColor(rgba, 2, true)).toEqual([0, 0, 0, 1]);
		expect(getColor(rgba, 40, true)).toEqual([200, 0, 0, 1]);
	});

	test('blend keeps a transparent cell fully transparent', () => {
		const s: RenderableColorScale = {
			...rgba,
			colors: [
				[0, 0, 0, 0],
				[100, 0, 0, 1],
				[200, 0, 0, 1]
			]
		};
		for (const px of [0, 5, 9.9]) expect(getColor(s, px, true)[3]).toBe(0);
		// fades in from the cell edge at 10 up to the next centre at 15
		expect(getColor(s, 12.5, true)[3]).toBe(0.5);
		expect(getColor(s, 15, true)).toEqual([100, 0, 0, 1]);
	});
});

describe('getColorScale', () => {
	test('visibility resolves to its own metre scale', () => {
		const scale = getColorScale('visibility', false);
		expect(scale.unit).toBe('m');
		expect(scale.type).toBe('breakpoint');
		if (scale.type === 'breakpoint') expect(scale.breakpoints[0]).toBe(0);
	});
});
