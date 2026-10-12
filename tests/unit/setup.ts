// eslint-disable-next-line @typescript-eslint/no-explicit-any
// jsdom has no canvas. Give modules a canvas element and a do-nothing 2D context so they can be imported.
const noop: any = new Proxy(() => {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : noop), apply: () => noop });
HTMLCanvasElement.prototype.getContext = (() => noop) as unknown as HTMLCanvasElement['getContext'];
const c = document.createElement('canvas');
c.id = 'c';
document.body.appendChild(c);
