/** Measure the real campus viewer using a hardware-backed desktop browser. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://127.0.0.1:3000' },
    mbps: { type: 'string', default: '10' },
    latency: { type: 'string', default: '150' },
    cpu: { type: 'string', default: '4' },
    trials: { type: 'string', default: '3' },
    output: {
      type: 'string',
      default: 'tmp/campus-3d/network-10mbps/loading.json',
    },
    'expect-gpu': { type: 'string' },
  },
});
const mbps = Number(values.mbps);
const latency = Number(values.latency);
const cpu = Number(values.cpu);
const trials = Number(values.trials);
assert.ok(Number.isFinite(mbps) && mbps > 0);
assert.ok(Number.isFinite(latency) && latency >= 0);
assert.ok(Number.isFinite(cpu) && cpu >= 1);
assert.ok(Number.isInteger(trials) && trials >= 1 && trials <= 20);
const modelPath = '/research/kmutt-bangmod/kmutt-bangmod-web.glb';
const model = await readFile(`apps/web/public${modelPath}`);
const report = {
  measuredAt: new Date().toISOString(),
  modelSha256: createHash('sha256').update(model).digest('hex'),
  browser: '',
  conditions: {
    downloadMbps: mbps,
    uploadMbps: 1,
    latencyMs: latency,
    cpuSlowdown: cpu,
    viewport: { width: 390, height: 844 },
    dpr: 2,
    physicalPhone: false,
    cache:
      'Fresh browser context per trial; reload within it for the repeat visit.',
  },
  trials: [],
};
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
try {
  report.browser = browser.version();
  for (let trial = 1; trial <= trials; trial++) {
    const context = await browser.newContext({
      viewport: report.conditions.viewport,
      deviceScaleFactor: report.conditions.dpr,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const session = await context.newCDPSession(page);
      const modelRequests = new Map();
      session.on('Network.requestWillBeSent', (event) => {
        if (new URL(event.request.url).pathname === modelPath)
          modelRequests.set(event.requestId, { requestId: event.requestId });
      });
      session.on('Network.responseReceivedExtraInfo', (event) => {
        const request = modelRequests.get(event.requestId);
        if (request) request.networkStatus = event.statusCode;
      });
      session.on('Network.responseReceived', (event) => {
        const request = modelRequests.get(event.requestId);
        if (request) request.fromDiskCache = event.response.fromDiskCache;
      });
      await session.send('Network.enable');
      await session.send('Network.setCacheDisabled', { cacheDisabled: false });
      await session.send('Network.emulateNetworkConditions', {
        offline: false,
        latency,
        downloadThroughput: (mbps * 1_000_000) / 8,
        uploadThroughput: 125_000,
        connectionType: 'cellular4g',
      });
      await session.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      await page.addInitScript(
        ({ modelPath }) => {
          const originalFetch = window.fetch.bind(window);
          window.fetch = async (input, init) => {
            const url =
              typeof input === 'string'
                ? input
                : input instanceof URL
                  ? input.href
                  : input.url;
            const start = performance.now();
            const response = await originalFetch(input, init);
            if (new URL(url, location.href).pathname !== modelPath)
              return response;
            const headersReady = performance.now();
            const arrayBuffer = response.arrayBuffer.bind(response);
            response.arrayBuffer = async () => {
              const data = await arrayBuffer();
              window.__campusDownload = {
                start,
                headersReady,
                bytesReady: performance.now(),
                decodedBytes: data.byteLength,
              };
              return data;
            };
            return response;
          };
        },
        { modelPath },
      );
      for (const visit of ['cold', 'repeat']) {
        if (visit === 'cold')
          await page.goto(new URL('/research/kmutt-bangmod', values.url).href);
        else await page.reload();
        await page.locator('[data-render-state=plan]').waitFor();
        assert.equal(
          await page.evaluate(() =>
            performance
              .getEntriesByType('resource')
              .some((item) => item.name.endsWith('.glb')),
          ),
          false,
        );
        const start = await page.evaluate(() => performance.now());
        await page
          .getByRole('button', { name: '3D แบบละเอียด', exact: true })
          .click();
        await page
          .locator('[data-render-state=ready]')
          .waitFor({ timeout: 120_000 });
        const sample = await page.evaluate(
          ({ start, modelPath }) => {
            const ready = performance.now();
            const resource = performance
              .getEntriesByType('resource')
              .find((item) => new URL(item.name).pathname === modelPath);
            const download = window.__campusDownload;
            const gl = document.querySelector('canvas').getContext('webgl2');
            const debug = gl.getExtension('WEBGL_debug_renderer_info');
            return {
              clickToReadyMs: ready - start,
              beforeModelRequestMs: download.start - start,
              requestToBytesReadyMs: download.bytesReady - download.start,
              bytesReadyToViewerReadyMs: ready - download.bytesReady,
              resourceDurationMs: resource.duration,
              encodedBodyBytes: resource.encodedBodySize,
              decodedBodyBytes: resource.decodedBodySize,
              transferSize: resource.transferSize,
              fetchedBytes: download.decodedBytes,
              renderer: debug
                ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
                : gl.getParameter(gl.RENDERER),
            };
          },
          { start, modelPath },
        );
        assert.equal(sample.fetchedBytes, model.byteLength);
        assert.doesNotMatch(sample.renderer, /swiftshader|software/i);
        if (values['expect-gpu'])
          assert.ok(sample.renderer.includes(values['expect-gpu']));
        assert.deepEqual(errors, []);
        const network = [...modelRequests.values()].at(-1);
        assert.ok(network);
        report.trials.push({ trial, visit, ...sample, network });
        process.stdout.write(`${JSON.stringify(report.trials.at(-1))}\n`);
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
await mkdir(path.dirname(values.output), { recursive: true });
await writeFile(values.output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `PASS ${report.trials.length} loading trials: ${values.output}\n`,
);
