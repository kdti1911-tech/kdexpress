export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { db } = await import("@/lib/db");
      const { setPermissionsCache, buildDefaultPermissionsMap } = await import("@/lib/permissions");
      const entries = await db.rolePermission.findMany();
      if (entries.length > 0) {
        setPermissionsCache(entries);
      } else {
        // Seed DB with defaults on first boot
        const defaults = buildDefaultPermissionsMap();
        await db.rolePermission.createMany({ data: defaults });
        setPermissionsCache(defaults);
      }
    } catch {
      // DB not ready yet — can() will use hardcoded defaults until cache is loaded
    }
  }
}
