// Task storage. Both stores expose the same interface:
//   start(onTasks, onLiveError)  onTasks receives the full task array on every change
//   add(data) · set(id, data) · update(id, patch) · remove(id)
// Write failures throw an Error whose .code is "forbidden" or "failed".
(function () {
  function fail(code, cause) { const e = new Error(code); e.code = code; e.cause = cause; return e; }
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  function supabaseStore(sb) {
    const byId = new Map();
    let emit = () => {};
    const push = () => emit([...byId.values()]);
    const tbl = () => sb.from("tasks");
    const check = (error) => { if (error) throw fail(error.code === "42501" ? "forbidden" : "failed", error); };

    async function reload() {
      const { data, error } = await tbl().select("*");
      check(error);
      byId.clear();
      data.forEach((r) => byId.set(r.id, r));
      push();
    }

    return {
      async start(onTasks, onLiveError) {
        emit = onTasks;
        await reload();
        sb.channel("tasks-live")
          .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (ev) => {
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
      async add(data) {
        const { data: rows, error } = await tbl().insert({ id: newId(), ...data }).select();
        check(error);
        rows.forEach((r) => byId.set(r.id, r)); push();
      },
      async set(id, data) { return this.update(id, data); },
      async update(id, patch) {
        const { data: rows, error } = await tbl().update(patch).eq("id", id).select();
        check(error);
        if (!rows.length) throw fail("forbidden");
        rows.forEach((r) => byId.set(r.id, r)); push();
      },
      async remove(id) {
        const { data: rows, error } = await tbl().delete().eq("id", id).select("id");
        check(error);
        if (!rows.length) throw fail("forbidden");
        byId.delete(id); push();
      },
    };
  }

  function localStore() {
    const KEY = "ila_tasks";
    let tasks = [];
    let emit = () => {};
    try { tasks = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { tasks = []; }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch (e) { throw fail("failed", e); }
      emit(tasks.slice());
    }
    return {
      async start(onTasks) { emit = onTasks; emit(tasks.slice()); },
      async add(data) { tasks.push({ id: newId(), ...data }); save(); },
      async set(id, data) { tasks = tasks.map((t) => (t.id === id ? { id, ...data } : t)); save(); },
      async update(id, patch) { tasks = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)); save(); },
      async remove(id) { tasks = tasks.filter((t) => t.id !== id); save(); },
    };
  }

  window.IlaStore = { supabaseStore, localStore };
})();
