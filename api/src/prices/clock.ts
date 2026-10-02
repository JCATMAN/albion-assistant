/** Clock injected so freshness tests choose the current instant. */
export const CLOCK = Symbol('CLOCK');

export type Clock = () => Date;
