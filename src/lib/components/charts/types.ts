import type { Readable } from 'svelte/store';

export interface LayerCakeContext {
	data: Readable<unknown[]>;
	width: Readable<number>;
	height: Readable<number>;
	xScale: Readable<(d: unknown) => number>;
	yScale: Readable<(d: number) => number>;
	xGet: Readable<(d: unknown) => number>;
	yGet: Readable<(d: unknown) => number>;
	x: Readable<(d: unknown) => unknown>;
	y: Readable<(d: unknown) => unknown>;
	extents: Readable<{ x?: [number, number]; y?: [number, number] }>;
}
