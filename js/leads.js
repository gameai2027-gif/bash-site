(function (root) {
  var KEY = "bash-site-leads";
  var PACK = {
    control: "Заявки под контролем",
    sell: "Сайт, который продаёт",
    full: "Полный цикл"
  };
  var SITE_STATUS = {
    none: "Сайта нет",
    old: "Есть, но устарел",
    weak: "Есть, но не даёт заявок"
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

  function now() { return Date.now(); }

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

  function summary(lead) {
    return [
      "Новая заявка BASH Site",
      "Имя: " + lead.name,
      "Связь: " + lead.phone,
      "Ниша: " + (lead.business || "—"),
      "Город / район: " + (lead.city || "—"),
      "Сайт: " + (SITE_STATUS[lead.siteStatus] || lead.siteStatus || "—"),
      "Пакет: " + (PACK[lead.package] || lead.package || "демо"),
      "Задача: " + (lead.message || "—")
    ].join("\n");
  }

  function notifyTelegram(lead) {
    var cfg = root.BASH_SITE_CONFIG || {};
    var token = cfg.telegramBotToken;
    var chat = cfg.telegramChatId;
    if (!token || !chat) {
      return Promise.resolve({ ok: false, skipped: true });
    }
    var url = "https://api.telegram.org/bot" + token + "/sendMessage";
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: summary(lead)
      })
    }).then(function (r) { return r.json(); }).catch(function () {
      return { ok: false };
    });
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
      city: String(data.city || "").trim(),
      siteStatus: data.siteStatus || "",
      package: pkg,
      message: String(data.message || "").trim(),
      status: "new",
      source: data.source || "site",
      createdAt: now(),
      updatedAt: now(),
      events: [
        event("created", "Заявка с сайта BASH Site."),
        event("auto_welcome", "Клиенту: заявка принята, ответ в течение одного рабочего дня."),
        event("auto_qualify", "Уточнить услугу, район и канал связи перед демо.")
      ]
    };
    rows.unshift(lead);
    save(rows);
    lead._notify = notifyTelegram(lead).then(function (res) {
      if (res && res.ok) {
        var fresh = load();
        var row = fresh.find(function (x) { return x.id === lead.id; });
        if (row) {
          row.events.push(event("auto_telegram", "Заявка ушла в Telegram."));
          save(fresh);
        }
      } else if (!(res && res.skipped)) {
        var fresh2 = load();
        var row2 = fresh2.find(function (x) { return x.id === lead.id; });
        if (row2) {
          row2.events.push(event("auto_telegram", "Telegram не настроен или не принял сообщение. Заявка сохранена в кабинете."));
          save(fresh2);
        }
      } else {
        var fresh3 = load();
        var row3 = fresh3.find(function (x) { return x.id === lead.id; });
        if (row3) {
          row3.events.push(event("auto_telegram", "Telegram-токен не задан. Заявка только в кабинете."));
          save(fresh3);
        }
      }
      return res;
    });
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
    [
      { name: "Руслан", phone: "+7 917 000-00-01", business: "Электромонтаж", city: "Уфа", siteStatus: "none", package: "full", message: "Нужен сайт и контроль заявок" },
      { name: "Алексей", phone: "+7 967 000-00-02", business: "Видеонаблюдение", city: "Уфа", siteStatus: "weak", package: "sell", message: "Сайт есть, заявок нет" },
      { name: "Ирина", phone: "+7 927 000-00-03", business: "Слаботочка", city: "Пригород", siteStatus: "old", package: "control", message: "Заявки теряются в чатах" }
    ].forEach(function (s, i) {
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
      row.events.push(event("reminder", "Нет движения больше суток. Связаться."));
      row.updatedAt = now();
      count += 1;
    });
    save(rows);
    return count;
  }

  function injectMetrika() {
    var id = (root.BASH_SITE_CONFIG || {}).metrikaId;
    if (!id || root.ym) return;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
    ym(id, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }

  root.BashLeads = {
    KEY: KEY,
    PACK: PACK,
    SITE_STATUS: SITE_STATUS,
    STATUSES: STATUSES,
    load: load,
    save: save,
    create: create,
    updateStatus: updateStatus,
    addNote: addNote,
    seedIfEmpty: seedIfEmpty,
    reminders: reminders,
    waLink: waLink,
    injectMetrika: injectMetrika
  };
})(window);
