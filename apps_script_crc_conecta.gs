const CONFIG = {
  SHEET_ID: '1BDIFYqCf4QpIWvpDw0oqIXLWanyrdOAoikdqeYbi2wk',
  FROM_NAME: 'CRC Conecta - Colegio Republica de China I.E.D.',
  NOTIFY_EMAIL_COPY: '',
};

const WHATSAPP_AUTHORIZED = [
  'GOMEZ URREGO JUAN FRANCISCO',
  'JUAN CARLOS SUAREZ GOMEZ',
  'SUAREZ GOMEZ JUAN CARLOS',
  'JUAN CARLOS SUAREZ GOMEZ',
];

const SHEETS = {
  asistencia: 'Asistencia',
  observador: 'Observador',
  notificaciones: 'Notificaciones',
  docentes: 'Docentes',
  whatsapp: 'WhatsApp',
};

function doPost(e) {
  try {
    const raw = e && e.parameter && e.parameter.payload
      ? e.parameter.payload
      : (e.postData && e.postData.contents || '{}');
    const data = JSON.parse(raw || '{}');
    const teacher = validateTeacherPin_(data.pin);
    if (!teacher.ok) return json_({ ok: false, error: 'PIN docente no valido.' });

    if (data.action === 'attendance') return handleAttendance_(data, teacher);
    if (data.action === 'observation') return handleObservation_(data, teacher);
    if (data.action === 'whatsapp') return handleWhatsApp_(data, teacher);
    return json_({ ok: false, error: 'Accion no reconocida.' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function handleAttendance_(data, teacher) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sh = getSheet_(ss, SHEETS.asistencia, [
    'timestamp', 'fecha', 'curso', 'estudiante', 'estado', 'uniforme', 'docente', 'correo', 'acudiente',
  ]);
  sh.appendRow([
    new Date(), data.fecha, data.curso, data.estudiante, data.estado, data.uniforme || '',
    teacher.name, data.correo || '', data.acudiente || '',
  ]);

  const shouldNotify = data.correo && (data.estado === 'no-asiste' || data.estado === 'tarde');
  if (shouldNotify) {
    const sent = sendOnce_(ss, {
      tipo: data.estado,
      fecha: data.fecha,
      curso: data.curso,
      estudiante: data.estudiante,
      correo: data.correo,
      acudiente: data.acudiente || '',
      docente: teacher.name,
      subject: attendanceSubject_(data),
      body: attendanceBody_(data, teacher),
    });
    return json_({ ok: true, emailSent: sent });
  }
  return json_({ ok: true, emailSent: false });
}

function handleObservation_(data, teacher) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sh = getSheet_(ss, SHEETS.observador, [
    'timestamp', 'fecha', 'curso', 'estudiante', 'docente', 'tipo', 'categoria', 'correo', 'telefono', 'descripcion', 'seguimiento',
  ]);
  sh.appendRow([
    new Date(), data.fecha, data.curso, data.estudiante, teacher.name, data.tipo, data.categoria,
    data.correo || '', data.telefono || '', data.descripcion || '', data.seguimiento || '',
  ]);

  if (!data.correo) return json_({ ok: true, emailSent: false });
  const sent = sendOnce_(ss, {
    tipo: 'observacion',
    fecha: data.fecha,
    curso: data.curso,
    estudiante: data.estudiante,
    correo: data.correo,
    acudiente: data.acudiente || '',
    docente: teacher.name,
    subject: `Registro en observador - ${data.estudiante} - ${data.fecha}`,
    body: data.emailText || observationBody_(data, teacher),
  });
  return json_({ ok: true, emailSent: sent });
}

function handleWhatsApp_(data, teacher) {
  if (!canUseWhatsApp_(teacher.name)) {
    return htmlMessage_('Permiso no autorizado', 'Este envio de WhatsApp solo esta habilitado para Coordinacion y Juan Carlos Suarez Gomez.');
  }

  const phone = normalizePhone_(data.telefono);
  if (!phone) return htmlMessage_('Telefono no valido', 'El estudiante no tiene un numero de WhatsApp valido.');

  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sh = getSheet_(ss, SHEETS.whatsapp, [
    'timestamp', 'fecha', 'curso', 'estudiante', 'telefono', 'docente', 'estado',
  ]);
  sh.appendRow([new Date(), data.fecha || '', data.curso || '', data.estudiante || '', phone, teacher.name, 'ABIERTO']);

  const message = data.message || data.emailText || `Cordial saludo. Desde CRC Conecta se registra novedad para ${data.estudiante || 'el/la estudiante'}.`;
  const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><head><base target="_top"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:Arial,sans-serif;padding:28px;color:#0b2f5f}a{display:inline-block;margin-top:14px;background:#128c7e;color:white;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:700}</style>' +
    '</head><body><h2>Abriendo WhatsApp...</h2><p>Permiso validado para ' + escapeHtml_(teacher.name) + '.</p><a href="' + url + '">Abrir WhatsApp</a>' +
    '<script>window.location.replace(' + JSON.stringify(url) + ');</script></body></html>'
  );
}

function validateTeacherPin_(pin) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sh = getSheet_(ss, SHEETS.docentes, ['pin', 'docente', 'activo']);
  const values = sh.getDataRange().getValues();
  const input = String(pin || '').trim();
  for (let i = 1; i < values.length; i++) {
    const rowPin = String(values[i][0] || '').trim();
    const name = String(values[i][1] || '').trim();
    const active = String(values[i][2] || '').toLowerCase();
    if (rowPin && rowPin === input && active !== 'no') return { ok: true, name };
  }
  return { ok: false };
}

function canUseWhatsApp_(name) {
  const normalized = normalizeText_(name);
  return WHATSAPP_AUTHORIZED.map(normalizeText_).indexOf(normalized) >= 0;
}

function sendOnce_(ss, item) {
  const sh = getSheet_(ss, SHEETS.notificaciones, [
    'clave', 'timestamp', 'tipo', 'fecha', 'curso', 'estudiante', 'correo', 'docente', 'estado',
  ]);
  const key = [item.tipo, item.fecha, item.curso, item.estudiante, item.correo].join('|').toUpperCase();
  const existing = sh.getDataRange().getValues().slice(1).some(row => String(row[0] || '') === key);
  if (existing) return false;

  MailApp.sendEmail({
    to: item.correo,
    subject: item.subject,
    body: item.body,
    name: CONFIG.FROM_NAME,
    cc: CONFIG.NOTIFY_EMAIL_COPY || undefined,
  });
  sh.appendRow([key, new Date(), item.tipo, item.fecha, item.curso, item.estudiante, item.correo, item.docente, 'ENVIADO']);
  return true;
}

function attendanceSubject_(data) {
  const label = data.estado === 'no-asiste' ? 'Inasistencia' : 'Llegada tarde';
  return `${label} - ${data.estudiante} - ${data.fecha}`;
}

function attendanceBody_(data, teacher) {
  const label = data.estado === 'no-asiste' ? 'no asistio' : 'registro llegada tarde';
  return `Cordial saludo.\n\nDesde CRC Conecta informamos que el/la estudiante ${data.estudiante}, del curso ${data.curso}, ${label} el dia ${data.fecha}.\n\nRegistro realizado por: ${teacher.name}.\n\nColegio Republica de China I.E.D.`;
}

function observationBody_(data, teacher) {
  return `Cordial saludo.\n\nSe registro una observacion para el/la estudiante ${data.estudiante}, curso ${data.curso}.\n\nTipo: ${data.tipo}\nCategoria: ${data.categoria}\nDescripcion: ${data.descripcion || ''}\nSeguimiento: ${data.seguimiento || ''}\n\nRegistro realizado por: ${teacher.name}.\n\nColegio Republica de China I.E.D.`;
}

function normalizePhone_(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) digits = '57' + digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return '';
}

function normalizeText_(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\s+/g, ' ');
}

function htmlMessage_(title, message) {
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><head><base target="_top"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:Arial,sans-serif;padding:28px;color:#0b2f5f;line-height:1.45}</style></head><body>' +
    '<h2>' + escapeHtml_(title) + '</h2><p>' + escapeHtml_(message) + '</p></body></html>'
  );
}

function escapeHtml_(value) {
  return String(value || '').replace(/[&<>"']/g, function (ch) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
}

function getSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
