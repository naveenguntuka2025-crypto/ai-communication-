export interface RehearsalRecord {
  timestamp: string;
  speechTitle: string;
  durationSeconds: number;
  wordCount: number;
  wpm: number;
  pacingStatus: string;
  clarityScore: number;
  confidenceScore: number;
  fillerWordsTotal: number;
  overallTone: string;
  executiveSummary: string;
}

export interface SentEmailRecord {
  id: string;
  snippet: string;
  subject?: string;
  date?: string;
}

// ----------------- GOOGLE SHEETS -----------------

export async function findOrCreateSpreadsheet(
  accessToken: string,
  title = "Mindful Orator - Speech Practice Log"
): Promise<{ id: string; url: string; createdNew: boolean }> {
  // Search if a sheet with this title exists
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    `name = '${title}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
  )}&fields=files(id,name,webViewLink)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return {
        id: data.files[0].id,
        url: data.files[0].webViewLink || `https://docs.google.com/spreadsheets/d/${data.files[0].id}/edit`,
        createdNew: false,
      };
    }
  }

  // Create new spreadsheet
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        {
          properties: { title: "Practice Log" },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: "Timestamp" } },
                    { userEnteredValue: { stringValue: "Speech Title" } },
                    { userEnteredValue: { stringValue: "Duration (s)" } },
                    { userEnteredValue: { stringValue: "Word Count" } },
                    { userEnteredValue: { stringValue: "Cadence (WPM)" } },
                    { userEnteredValue: { stringValue: "Pacing Status" } },
                    { userEnteredValue: { stringValue: "Clarity Score" } },
                    { userEnteredValue: { stringValue: "Confidence" } },
                    { userEnteredValue: { stringValue: "Filler Words" } },
                    { userEnteredValue: { stringValue: "Tone Assessment" } },
                    { userEnteredValue: { stringValue: "Executive Feedback Summary" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(err?.error?.message || "Failed to create Google Spreadsheet");
  }

  const created = await createRes.json();
  return {
    id: created.spreadsheetId,
    url: created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
    createdNew: true,
  };
}

export async function appendRehearsalRow(
  accessToken: string,
  spreadsheetId: string,
  record: RehearsalRecord
): Promise<boolean> {
  // First identify sheet tab name
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let sheetName = "Practice Log";
  if (metaRes.ok) {
    const meta = await metaRes.json();
    if (meta.sheets && meta.sheets.length > 0) {
      sheetName = meta.sheets[0].properties.title || "Practice Log";
    }
  }

  const range = `'${sheetName}'!A:K`;
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}:append?valueInputOption=USER_ENTERED`;

  const values = [
    [
      record.timestamp,
      record.speechTitle,
      record.durationSeconds,
      record.wordCount,
      record.wpm,
      record.pacingStatus,
      record.clarityScore,
      record.confidenceScore,
      record.fillerWordsTotal,
      record.overallTone,
      record.executiveSummary,
    ],
  ];

  const res = await fetch(appendUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || "Failed to append row to Google Sheets");
  }

  return true;
}

export async function fetchRehearsalRows(
  accessToken: string,
  spreadsheetId: string
): Promise<string[][]> {
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let sheetName = "Practice Log";
  if (metaRes.ok) {
    const meta = await metaRes.json();
    if (meta.sheets && meta.sheets.length > 0) {
      sheetName = meta.sheets[0].properties.title || "Practice Log";
    }
  }

  const range = `'${sheetName}'!A1:K50`;
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}`;

  const res = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return data.values || [];
}

// ----------------- GMAIL -----------------

export async function sendRehearsalEmail(
  accessToken: string,
  options: {
    to: string;
    subject: string;
    bodyHtml: string;
    fromEmail?: string;
  }
): Promise<{ id: string }> {
  // Construct RFC 2822 email format
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(options.subject)))}?=`;
  const messageParts = [
    `To: ${options.to}`,
    options.fromEmail ? `From: ${options.fromEmail}` : "",
    `Subject: ${utf8Subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(options.bodyHtml))),
  ].filter(Boolean);

  const rawMessage = messageParts.join("\r\n");

  // Base64url encode
  const base64Encoded = btoa(rawMessage)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: base64Encoded }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || "Failed to send email via Gmail");
  }

  return await res.json();
}

export async function fetchSentRehearsalEmails(
  accessToken: string,
  maxResults = 5
): Promise<SentEmailRecord[]> {
  const query = encodeURIComponent("subject:Mindful Orator");
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${maxResults}`;

  const res = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return [];

  const data = await res.json();
  if (!data.messages || !Array.isArray(data.messages)) return [];

  const records: SentEmailRecord[] = [];
  for (const m of data.messages.slice(0, maxResults)) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        const headers = msgData.payload?.headers || [];
        const subj = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value;
        const date = headers.find((h: any) => h.name.toLowerCase() === "date")?.value;
        records.push({
          id: m.id,
          snippet: msgData.snippet || "Rehearsal feedback report",
          subject: subj,
          date,
        });
      }
    } catch {
      // Continue
    }
  }

  return records;
}
