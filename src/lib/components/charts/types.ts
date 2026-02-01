import type { Readable } from 'svelte/store';

export interface LayerCakeContext {
	data: Readable<unknown[]>;
	width: Readable<number>;
	height: Readable<number>;
	xScale: Readable<((d: unknown) => number) & { bandwidth?: () => number }>;
	yScale: Readable<(d: number) => number>;
	zScale: Readable<(d: unknown) => string>;
	xGet: Readable<(d: unknown) => number>;
	yGet: Readable<(d: unknown) => number | [number, number]>;
	zGet: Readable<(d: unknown) => string>;
	x: Readable<(d: unknown) => unknown>;
	y: Readable<(d: unknown) => unknown>;
	z: Readable<(d: unknown) => unknown>;
	extents: Readable<{ x?: [number, number]; y?: [number, number] }>;
}
