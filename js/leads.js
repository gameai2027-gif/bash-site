(function (root) {
  var KEY = "bash-site-leads";
  var PACK = {
    control: "Заявки под контролем",
    sell: "Сайт, который продаёт",
    full: "Полный цикл"
  };
  var STATUSES = [
    ["new", "Новая"],
    ["contact", "Связались"],
    ["demo", "Демо"],
    ["deal", "Сделка"],
    ["lost", "Отказ"]
  ];

  function load() {
    try {
      var rows = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      return [];
    }
  }

  function save(rows) {
    localStorage.setItem(KEY, JSON.stringify(rows));
  }

  function now() {
    return Date.now();
  }

  function event(kind, body) {
    return { kind: kind, body: body, at: now() };
  }

  function digits(phone) {
    return String(phone || "").replace(/\D/g, "");
  }

  function waLink(phone) {
    var d = digits(phone);
    if (d.length === 11 && d[0] === "8") d = "7" + d.slice(1);
    if (d.length === 10) d = "7" + d;
    return d ? "https://wa.me/" + d : "";
  }

  function create(data) {
    var rows = load();
    var name = String(data.name || "").trim();
    var phone = String(data.phone || "").trim();
    var pkg = data.package || "sell";
    var lead = {
      id: now(),
      name: name,
      phone: phone,
      business: String(data.business || "").trim(),
      package: pkg,
      message: String(data.message || "").trim(),
      status: "new",
      source: data.source || "site",
      createdAt: now(),
      updatedAt: now(),
      events: [
        event("created", "Заявка поступила с сайта BASH Site."),
        event("auto_welcome", "Клиенту: «" + name + ", заявка принята. Пакет «" + (PACK[pkg] || pkg) + "». Ответим в рабочее время»."),
        event("auto_telegram", "Уведомление владельцу: новая заявка в кабинете."),
        event("auto_qualify", "Сценарий квалификации: ниша, есть ли сайт, когда удобно созвониться.")
      ]
    };
    rows.unshift(lead);
    save(rows);
    return lead;
  }

  function updateStatus(id, status) {
    var rows = load();
    var row = rows.find(function (x) { return x.id === id; });
    if (!row) return null;
    var label = (STATUSES.find(function (s) { return s[0] === status; }) || [status, status])[1];
    row.status = status;
    row.updatedAt = now();
    row.events = row.events || [];
    row.events.push(event("status", "Статус → " + label));
    save(rows);
    return row;
  }

  function addNote(id, body) {
    var rows = load();
    var row = rows.find(function (x) { return x.id === id; });
    if (!row) return null;
    row.updatedAt = now();
    row.events = row.events || [];
    row.events.push(event("note", body));
    save(rows);
    return row;
  }

  function seedIfEmpty() {
    if (load().length) return false;
    var samples = [
      { name: "Руслан", phone: "+7 917 439-14-05", business: "ООО ЭЛЕКТРОМОНТАЖ", package: "full", message: "Нет сайта, нужен монтаж + заявки" },
      { name: "Алексей", phone: "8-967-454-15-58", business: "Системы Безопасности РБ", package: "sell", message: "Хотим демо под видеонаблюдение" },
      { name: "Ирина", phone: "+7 927 962-45-54", business: "Абажур", package: "control", message: "Слаботочка, заявки теряются в WhatsApp" }
    ];
    samples.forEach(function (s, i) {
      var lead = create(s);
      if (i === 1) updateStatus(lead.id, "contact");
      if (i === 2) updateStatus(lead.id, "demo");
    });
    return true;
  }

  function reminders() {
    var rows = load();
    var count = 0;
    var limit = now() - 24 * 60 * 60 * 1000;
    rows.forEach(function (row) {
      if (row.status === "deal" || row.status === "lost") return;
      if ((row.updatedAt || row.createdAt || 0) > limit) return;
      row.events = row.events || [];
      var already = row.events.some(function (e) { return e.kind === "reminder" && e.at > limit; });
      if (already) return;
      row.events.push(event("reminder", "Напоминание: заявка без движения больше суток. Позвонить / написать в WhatsApp."));
      row.updatedAt = now();
      count += 1;
    });
    save(rows);
    return count;
  }

  root.BashLeads = {
    KEY: KEY,
    PACK: PACK,
    STATUSES: STATUSES,
    load: load,
    save: save,
    create: create,
    updateStatus: updateStatus,
    addNote: addNote,
    seedIfEmpty: seedIfEmpty,
    reminders: reminders,
    waLink: waLink
  };
})(window);
