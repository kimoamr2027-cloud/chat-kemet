// استيراد بيانات Firebase (بيتحمّل بـ require من migrate.pb.js)
function run(app, dir) {
  const D = JSON.parse(toString($os.readFile(dir + "/data.json")))
  const counts = {}
  const inc = (k) => { counts[k] = (counts[k] || 0) + 1 }
  let tx = app
  const col = (n) => tx.findCollectionByNameOrId(n)
  const find = (n, id) => { try { return tx.findRecordById(n, id) } catch (_) { return null } }
  // التواريخ القديمة (created بيتحط لوحده، فبنرجّعه بـ SQL)
  const setCreated = (table, id, at) => {
    if (!at) return
    const t = String(at).replace("T", " ")
    tx.db().newQuery("UPDATE `" + table + "` SET created = {:c} WHERE id = {:id}").bind({ c: t, id }).execute()
  }
  const put = (rec, obj) => { for (const k in obj) if (obj[k] !== undefined && obj[k] !== null) rec.set(k, obj[k]) }

  app.runInTransaction((t) => {
    tx = t
    // الأدوار
    if (D.roles) {
      const r = tx.findRecordById("config", "roles")
      r.set("data", D.roles); tx.save(r); inc("roles")
    }
    if (D.filter) {
      const r = tx.findRecordById("config", "filter")
      r.set("data", D.filter); tx.save(r); inc("filter")
    }
    // الأعضاء
    for (const u of D.users || []) {
      let r = null
      try { r = tx.findRecordById("users", u.id) } catch (_) {}
      if (!r) {
        r = new Record(col("users"))
        r.set("id", u.id)
        r.set("email", u.id.toLowerCase() + "@users.kemet.local")
        r.set("emailVisibility", false)
        r.set("verified", true)
        r.setPassword($security.randomString(40))
      }
      put(r, { name: u.name, gender: u.gender, bio: u.bio, city: u.city, avatar: u.avatar, rooms: u.rooms || [] })
      if (u.age) r.set("age", u.age)
      tx.save(r); inc("users")
    }
    for (const p of D.photos || []) {
      const id = p.owner + "_" + p.slot
      let r = null
      try { r = tx.findRecordById("photos", id) } catch (_) {}
      if (!r) { r = new Record(col("photos")); r.set("id", id) }
      put(r, { owner: p.owner, slot: p.slot, data: p.data }); tx.save(r); inc("photos")
    }
    for (const s of D.settings || []) {
      let r = null
      try { r = tx.findRecordById("settings", s.id) } catch (_) {}
      if (!r) { r = new Record(col("settings")); r.set("id", s.id) }
      put(r, { blocked: s.blocked || {}, dmWho: s.dmWho, noReceipts: !!s.noReceipts, hideOnline: !!s.hideOnline, notif: s.notif || {} })
      tx.save(r); inc("settings")
    }
    // الغرف
    for (const g of D.rooms || []) {
      let r = null
      try { r = tx.findRecordById("rooms", g.id) } catch (_) {}
      if (!r) { r = new Record(col("rooms")); r.set("id", g.id) }
      put(r, { name: g.name, order: g.order || 0, photo: g.photo || "", pinned: g.pinned || null })
      tx.save(r); inc("rooms")
    }
    // الصور والفويس (ملفات حقيقية)
    const mediaId = {}
    for (const m of D.media || []) {
      const r = new Record(col("media"))
      put(r, { owner: m.owner, type: m.type, room: m.room || "", chat: m.chat || "" })
      if (m.chat) { const p = m.chat.split("_"); r.set("a", p[0]); r.set("b", p[1]) }
      r.set("file", $filesystem.fileFromPath(dir + "/" + m.file))
      tx.save(r)
      setCreated("media", r.id, m.created)
      mediaId[m.key] = r.id; inc("media")
    }
    const msgFields = (m) => ({
      uid: m.uid, kind: m.kind, text: m.text || "", sticker: m.sticker, w: m.w, h: m.h, dur: m.dur, thumb: m.thumb || "",
      table: m.table || "", replyTo: m.replyTo || null, reactions: m.reactions || {}, edited: !!m.edited,
      media: m.mediaKey ? mediaId[m.mediaKey] || "" : "",
    })
    for (const m of D.messages || []) {
      if (!find("rooms", m.room)) continue
      const r = new Record(col("messages"))
      put(r, Object.assign(msgFields(m), { room: m.room, name: m.name, gender: m.gender }))
      tx.save(r)
      setCreated("messages", r.id, m.created)
      inc("messages")
    }
    // الخاص
    const dmId = {}
    for (const m of D.dms || []) {
      const r = new Record(col("dms"))
      const p = m.chat.split("_")
      put(r, Object.assign(msgFields(m), { chat: m.chat, a: p[0], b: p[1] }))
      tx.save(r)
      setCreated("dms", r.id, m.created)
      dmId[m.key] = r.id; inc("dms")
    }
    for (const c of D.chats || []) {
      let r = null
      try { r = tx.findRecordById("chats", c.id) } catch (_) {}
      if (!r) { r = new Record(col("chats")); r.set("id", c.id) }
      const last = c.last ? { uid: c.last.uid, text: c.last.text, at: c.last.at, id: c.last.key ? dmId[c.last.key] || "" : "" } : null
      put(r, { a: c.a, b: c.b, last, unread: c.unread || {}, readAt: c.readAt || {}, active: c.active || {}, typing: {} })
      if (c.updatedAt) r.set("updatedAt", c.updatedAt)
      tx.save(r); inc("chats")
    }
    // الكوينز
    for (const w of D.wallets || []) {
      let r = null
      try { r = tx.findRecordById("wallets", w.id) } catch (_) {}
      if (!r) { r = new Record(col("wallets")); r.set("id", w.id) }
      put(r, { coins: w.coins, day: w.day || 0, streak: w.streak || 0 }); tx.save(r); inc("wallets")
    }
    for (const l of D.coinlog || []) {
      const r = new Record(col("coinlog"))
      put(r, { owner: l.owner, amount: l.amount, kind: l.kind, note: l.note }); tx.save(r)
      setCreated("coinlog", r.id, l.created); inc("coinlog")
    }
    for (const s of D.scores || []) {
      let r = null
      try { r = tx.findRecordById("scores", s.id) } catch (_) {}
      if (!r) { r = new Record(col("scores")); r.set("id", s.id) }
      put(r, { board: s.board, uid: s.uid, name: s.name, week: s.week || "", n: s.n }); tx.save(r); inc("scores")
    }
    // الحظر والكتم
    for (const b of D.bans || []) {
      if (find("bans", b.id)) continue
      const r = new Record(col("bans")); r.set("id", b.id)
      put(r, { name: b.name, reason: b.reason, by: b.by }); tx.save(r); inc("bans")
    }
    for (const x of D.restrict || []) {
      if (find("restrict", x.id)) continue
      const r = new Record(col("restrict")); r.set("id", x.id)
      put(r, { room: x.room, uid: x.uid, type: x.type, until: x.until, name: x.name, by: x.by, byName: x.byName }); tx.save(r); inc("restrict")
    }
    for (const x of D.reports || []) {
      const r = new Record(col("reports"))
      put(r, { reporter: x.reporter, reported: x.reported, reportedName: x.reportedName, reason: x.reason, chatId: x.chatId }); tx.save(r); inc("reports")
    }
  })
  return counts
}


module.exports = { run }
