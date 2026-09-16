import test from "node:test";
import assert from "node:assert/strict";
import { createDriverSelection } from "../src/driver/selection.js";

test("an in-flight selection blocks disconnect and repeated selection until it finishes", async () => {
  const published: boolean[] = [];
  const selection = createDriverSelection(() => published.push(selection.active));
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let connected: string | null = "first";
  const select = selection.run(async () => {
    await pending;
    connected = "second";
  });
  const disconnect = () => {
    selection.assertIdle();
    connected = null;
  };
  try {
    assert.equal(selection.active, true);
    assert.deepEqual(published, [true]);
    assert.throws(disconnect, /CHAT_BUSY/);
    await assert.rejects(selection.run(async () => {}), /CHAT_BUSY/);
    assert.equal(connected, "first");
  } finally {
    release();
    await select;
  }
  assert.deepEqual(published, [true, false]);
  assert.equal(selection.active, false);
  assert.equal(connected, "second");
  disconnect();
  assert.equal(connected, null);
});

test("failed or cancelled selections always release and publish their busy state", async () => {
  const published: boolean[] = [];
  const selection = createDriverSelection(() => published.push(selection.active));
  await assert.rejects(selection.run(async () => { throw new Error("SELECTION_FAILED"); }), /SELECTION_FAILED/);
  assert.equal(selection.active, false);
  selection.assertIdle();
  await selection.run(async () => {});
  assert.deepEqual(published, [true, false, true, false]);
});
