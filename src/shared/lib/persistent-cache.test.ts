import { describe, expect, test } from "vite-plus/test";
import {
  clearPersistentCache,
  deletePersistentEntries,
  readPersistentEntry,
  writePersistentEntry,
} from "./persistent-cache";

describe("persistent cache", () => {
  test("stores structured values in IndexedDB", async () => {
    await writePersistentEntry("review:1", { threads: [{ id: "thread-1" }] });

    expect(await readPersistentEntry("review:1")).toEqual({ threads: [{ id: "thread-1" }] });
    expect(await readPersistentEntry("review:2")).toBeUndefined();
  });

  test("deletes the entries under a prefix that match a predicate", async () => {
    await writePersistentEntry("file:pr#1:aaa:src/a.ts", "a");
    await writePersistentEntry("file:pr#1:bbb:src/b.ts", "b");
    await writePersistentEntry("file:pr#12:bbb:src/c.ts", "c");

    await deletePersistentEntries("file:pr#1:", (key) => key.includes(":bbb:"));

    expect(await readPersistentEntry("file:pr#1:aaa:src/a.ts")).toBe("a");
    expect(await readPersistentEntry("file:pr#1:bbb:src/b.ts")).toBeUndefined();
    expect(await readPersistentEntry("file:pr#12:bbb:src/c.ts")).toBe("c");
  });

  test("clears every entry", async () => {
    await writePersistentEntry("review:1", { id: 1 });
    await clearPersistentCache();

    expect(await readPersistentEntry("review:1")).toBeUndefined();
  });
});
