export function createDriverSelection(publish: () => void) {
  let active = false;

  function assertIdle(): void {
    if (active) throw new Error("CHAT_BUSY");
  }

  return {
    get active() { return active; },
    assertIdle,
    async run(select: () => Promise<void>): Promise<void> {
      assertIdle();
      active = true;
      try {
        publish();
        await select();
      } finally {
        active = false;
        publish();
      }
    },
  };
}
