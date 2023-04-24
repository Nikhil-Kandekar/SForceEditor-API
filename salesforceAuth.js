require("dotenv").config();
const jsforce = require("jsforce");
const CUSTOMER_KEY = process.env.CUSTOMER_KEY;
const CUSTOMER_SECRET = process.env.CUSTOMER_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const redirectToSalesforceLogin = (req, res) => {
  const oauth2 = new jsforce.OAuth2({
    clientId: CUSTOMER_KEY,
    clientSecret: CUSTOMER_SECRET,
    redirectUri: `${req.protocol}://${req.get("host")}/${REDIRECT_URI}`,
  });
  res.redirect(oauth2.getAuthorizationUrl({}));
};

const getAccessToken = async (req, res) => {
  try {
    const oauth2 = new jsforce.OAuth2({
      clientId: CUSTOMER_KEY,
      clientSecret: CUSTOMER_SECRET,
      redirectUri: `${req.protocol}://${req.get("host")}/${REDIRECT_URI}`,
    });
    const conn = new jsforce.Connection({ oauth2: oauth2 });
    await conn.authorize(req.query.code);
    // console.log("AuthTok: " + conn.accessToken, "InstUrl: " + conn.instanceUrl); // access token via oauth2
    ACCESS_TOKEN = conn.accessToken;
    INSTANCE_URL = conn.instanceUrl;
    return { ACCESS_TOKEN, INSTANCE_URL };
  } catch (error) {
    res.json({ error: error.message });
  }
};

const getUserDetails = async (req, res) => {
  const INSTANCE_URL = req.cookies["Instance Url"];
  const ACCESS_TOKEN = req.cookies["Access Token"];
  if (INSTANCE_URL && ACCESS_TOKEN) {
    const conn2 = new jsforce.Connection({
      instanceUrl: INSTANCE_URL,
      accessToken: ACCESS_TOKEN,
    });
    try {
      const res = await conn2.identity();
      return {
        "user ID: ": res.user_id,
        "organization ID: ": res.organization_id,
        "username: ": res.username,
        "display name: ": res.display_name,
      };
    } catch (error) {
      console.error(error);
    }
  } else {
    redirectToSalesforceLogin(req, res);
  }
};

const queryVersionData = async (req, res, fileId) => {
  const INSTANCE_URL = req.cookies["Instance Url"];
  const ACCESS_TOKEN = req.cookies["Access Token"];
  if (INSTANCE_URL && ACCESS_TOKEN) {
    const conn2 = new jsforce.Connection({
      instanceUrl: INSTANCE_URL,
      accessToken: ACCESS_TOKEN,
    });
    try {
      const query = fileId
        ? `SELECT Id, ContentDocumentId, VersionData, Title, FileType, ContentUrl, PathOnClient, ContentSize, TagCsv, VersionNumber FROM ContentVersion WHERE ContentDocumentId = '${fileId}' AND Id IN (SELECT LatestPublishedVersionId FROM ContentDocument)`
        : "SELECT Id, ContentDocumentId, VersionData, Title, FileType, ContentUrl, PathOnClient, ContentSize, TagCsv, VersionNumber FROM ContentVersion"; // WHERE Id IN (SELECT LatestPublishedVersionId FROM ContentDocument)";
      const res = await conn2.query(query);
      return res;
    } catch (error) {
      console.error(error);
    }
  } else {
    redirectToSalesforceLogin(req, res);
  }
};

const insertVersionData = async (req, res, buf, fileName, conDocId) => {
  const INSTANCE_URL = req.cookies["Instance Url"];
  const ACCESS_TOKEN = req.cookies["Access Token"];
  if (INSTANCE_URL && ACCESS_TOKEN) {
    const conn2 = new jsforce.Connection({
      instanceUrl: INSTANCE_URL,
      accessToken: ACCESS_TOKEN,
    });
    try {
      const bufBase64 = Buffer.from(buf).toString("base64");
      const ret = await conn2.sobject("ContentVersion").create({
        PathOnClient: fileName,
        Title: fileName.split(".")[0],
        VersionData: bufBase64,
        ContentDocumentId: conDocId,
      });
      console.log("Created record id : " + ret.id);
    } catch (error) {
      console.error(error);
    }
  } else {
    redirectToSalesforceLogin(req, res);
  }
};

module.exports = {
  redirectToSalesforceLogin,
  getAccessToken,
  getUserDetails,
  queryVersionData,
  insertVersionData,
};
