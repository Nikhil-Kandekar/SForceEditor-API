const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");
const drive = google.drive("v3");
const sheets = google.sheets("v4");
const docs = google.docs("v1");
const util = require("util");

// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents",
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 */
async function getSheetData() {
  const authClient = await authorize();
  const request = {
    spreadsheetId: "1LXeQdAC8vUrkY9TzrWCFEv09lCjMdV9t_W5E3VwB4Gk",
    range: "A2:E",
    auth: authClient,
  };
  try {
    const res = await sheets.spreadsheets.values.get(request);
    // console.log(res.data);
    return res.data;
  } catch (error) {
    console.log(error);
  }
}
// getSheetData();

async function createSheet() {
  const authClient = await authorize();
  console.log(authClient);
  const request = {
    resource: {
      // TODO: Add desired properties to the request body.
    },
    auth: authClient,
  };

  try {
    const response = (await sheets.spreadsheets.create(request)).data;
    // TODO: Change code below to process the `response` object:
    console.log(JSON.stringify(response, null, 2));
    console.log(response.spreadsheetId);
    console.log(response.spreadsheetUrl);
  } catch (err) {
    console.error(err);
  }
}

async function createGoogleDoc(data) {
  const authClient = await authorize();
  console.log(authClient);
  const request = {
    resource: {
      // TODO: Add desired properties to the request body.
    },

    auth: authClient,
  };

  try {
    const response = (
      await docs.documents.create({
        auth: authClient,
        requestBody: {
          body: data.body,
        },
      })
    ).data;
    // TODO: Change code below to process the `response` object:
    console.log(JSON.stringify(response, null, 2));
    console.log(response.spreadsheetId);
    console.log(response.spreadsheetUrl);
  } catch (err) {
    console.error(err);
  }
}

async function getDoc() {
  const authClient = await authorize();
  const res = await docs.documents.get({
    documentId: "1sVWhnmUcYxF0yE6r2h_M2y9jN1Myx4UFnzieZkHA0YM",
    auth: authClient,
  });
  console.log(util.inspect(res.data, false, 17));
  console.log(res.data);
  return res.data;
}

async function uploadFileToDrive(data) {
  try {
    let buffer = Buffer.from(data.body, "base64");
    let deco = buffer.toString("utf8");
    const authClient = await authorize();
    const response = await drive.files.create({
      requestBody: {
        name: data.name,
        // mimeType: data.mimeType,
      },
      media: {
        mimeType: data.mimeType,
        body: deco, // not sure .....
      },
      auth: authClient,
    });
    // report the response from the request
    console.log(response.data);
    return response.data;
  } catch (error) {
    //report the error message
    console.log(error.message);
  }
}

module.exports = {
  createSheet,
  getSheetData,
  getDoc,
  uploadFileToDrive,
  createGoogleDoc,
};
