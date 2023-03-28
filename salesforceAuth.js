require("dotenv").config();
const jsforce = require("jsforce");
const CUSTOMER_KEY = process.env.CUSTOMER_KEY;
const CUSTOMER_SECRET = process.env.CUSTOMER_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

let ACCESS_TOKEN = undefined;
let INSTANCE_URL = undefined;

const redirectToSalesforceLogin = (req, res) => {
  const oauth2 = new jsforce.OAuth2({
    clientId: CUSTOMER_KEY,
    clientSecret: CUSTOMER_SECRET,
    redirectUri: `${req.protocol}://${req.get("host")}/${REDIRECT_URI}`,
  });
  res.redirect(oauth2.getAuthorizationUrl({}));
};

const getAccessToken = async (req, res) => {
  const oauth2 = new jsforce.OAuth2({
    clientId: CUSTOMER_KEY,
    clientSecret: CUSTOMER_SECRET,
    redirectUri: `${req.protocol}://${req.get("host")}/${REDIRECT_URI}`,
  });
  const conn = new jsforce.Connection({ oauth2: oauth2 });
  await conn.authorize(req.query.code);
  console.log("AuthTok: " + conn.accessToken, "InstUrl: " + conn.instanceUrl); // access token via oauth2
  ACCESS_TOKEN = conn.accessToken;
  INSTANCE_URL = conn.instanceUrl;
};

const getUserDetails = async (req, res) => {
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

module.exports = { redirectToSalesforceLogin, getAccessToken, getUserDetails };
