# CRC Conecta: correo único con PIN docente

## 1. Crear Google Sheet

1. Entra a Google Drive con la cuenta que enviará los correos.
2. Crea una hoja llamada `CRC Conecta Datos`.
3. Copia el ID de la hoja desde la URL.
   - Ejemplo: `https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit`

## 2. Crear Apps Script

1. Entra a `https://script.google.com`.
2. Crea un proyecto nuevo llamado `CRC Conecta Backend`.
3. Borra el contenido inicial.
4. Copia y pega el contenido de:
   `apps_script_crc_conecta.gs`
5. Cambia:
   `PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET`
   por el ID real de tu Google Sheet.
6. Guarda.

## 3. Crear PIN docente

1. Ejecuta una vez cualquier función del script para autorizar permisos.
2. En la Google Sheet abre la pestaña `Docentes`.
3. Agrega filas así:

| pin | docente | activo |
| --- | --- | --- |
| 1234 | SUAREZ GOMEZ JUAN CARLOS | si |
| 5678 | DOCENTE EJEMPLO | si |

El PIN se valida en Apps Script, no en el HTML.

## 4. Desplegar como Web App

1. En Apps Script, ve a `Deploy` / `Implementar`.
2. Selecciona `New deployment`.
3. Tipo: `Web app`.
4. Execute as: `Me`.
5. Who has access: `Anyone` o `Anyone with the link`.
6. Deploy.
7. Copia la URL que termina en `/exec`.

## 5. Pegar URL en CRC Conecta

En `index.html`, cambia:

```js
const APPS_SCRIPT_URL='PEGA_AQUI_LA_URL_DE_APPS_SCRIPT';
```

por la URL real de Apps Script.

## 6. Funcionamiento

- Si un estudiante queda en `No asiste`, se solicita PIN y se envía correo al acudiente.
- Si queda en `Tarde`, también se envía correo.
- Si el mismo evento ya fue notificado, Apps Script no repite el correo.
- En Observador, el botón `Enviar correo` manda el mensaje desde la cuenta única.

## 7. Antes de GitHub

No subas datos sensibles a un repositorio público. Lo ideal es que estudiantes, acudientes y asistencia vivan en Google Sheets, no dentro del HTML.
