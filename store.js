// Table storage. Every table has a text `id` primary key. Each table object exposes:
//   start(onRows, onLiveError)  onRows receives the full row array on every change
//   upsert(row) · update(id, patch) · remove(id)
// Write failures throw an Error whose .code is "forbidden" or "failed".
(function () {
  function fail(code, cause) { const e = new Error(code); e.code = code; e.cause = cause; return e; }
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  function supabaseTable(sb, name) {
    const byId = new Map();
    let emit = () => {};
    const push = () => emit([...byId.values()]);
    const tbl = () => sb.from(name);
    const check = (error) => { if (error) throw fail(error.code === "42501" ? "forbidden" : "failed", error); };
    const keep = (rows) => { rows.forEach((r) => byId.set(r.id, r)); push(); };

    async function reload() {
      const { data, error } = await tbl().select("*");
      check(error);
      byId.clear();
      keep(data);
    }

    return {
      async start(onRows, onLiveError) {
        emit = onRows;
        await reload();
        sb.channel("live-" + name)
          .on("postgres_changes", { event: "*", schema: "public", table: name }, (ev) => {
            if (ev.eventType === "DELETE") byId.delete(ev.old.id);
            else byId.set(ev.new.id, ev.new);
            push();
          })
          .subscribe((status) => {
            // Catch up on anything missed while disconnected.
            if (status === "SUBSCRIBED") reload().catch(() => {});
            else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onLiveError && onLiveError();
          });
        document.addEventListener("visibilitychange", () => { if (!document.hidden) reload().catch(() => {}); });
      },
      async upsert(row) {
        const { data, error } = await tbl().upsert({ id: row.id || newId(), ...row }).select();
        check(error);
        keep(data);
      },
      async update(id, patch) {
        const { data, error } = await tbl().update(patch).eq("id", id).select();
        check(error);
        if (!data.length) throw fail("forbidden");
        keep(data);
      },
      async remove(id) {
        const { data, error } = await tbl().delete().eq("id", id).select("id");
        check(error);
        if (!data.length) throw fail("forbidden");
        byId.delete(id); push();
      },
    };
  }

  function localTable(name) {
    const KEY = "ila_" + name;
    let rows = [];
    let emit = () => {};
    try { rows = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { rows = []; }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (e) { throw fail("failed", e); }
      emit(rows.slice());
    }
    return {
      async start(onRows) { emit = onRows; emit(rows.slice()); },
      async upsert(row) {
        const r = { id: row.id || newId(), ...row };
        const i = rows.findIndex((x) => x.id === r.id);
        if (i >= 0) rows[i] = { ...rows[i], ...r }; else rows.push(r);
        save();
      },
      async update(id, patch) { rows = rows.map((t) => (t.id === id ? { ...t, ...patch } : t)); save(); },
      async remove(id) { rows = rows.filter((t) => t.id !== id); save(); },
    };
  }

  function tables(make) {
    return { tasks: make("tasks"), metrics: make("metrics"), targets: make("targets") };
  }

  window.IlaStore = {
    supabase: (sb) => tables((n) => supabaseTable(sb, n)),
    local: () => tables(localTable),
  };
})();
