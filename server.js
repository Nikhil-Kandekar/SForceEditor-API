require("dotenv").config();
const app = require("express")();
const { createSheet, getSheetData } = require("./googleAuth");
const {
  redirectToSalesforceLogin,
  getAccessToken,
  getUserDetails,
  queryVersionData,
} = require("./salesforceAuth");
const PORT = process.env.PORT || 5000;

app.get("/", (_req, res) => {
  res.send("Hey!");
});

// ------------- Google Auth ------------------

app.get("/getSheetData", async (_req, res) => {
  const data = await getSheetData();
  console.log(data);
  res.send(data);
});

// ------------- Salesforce Auth ------------------

app.get("/salesforceAuth", async (req, res) => {
  await redirectToSalesforceLogin(req, res);
});

app.get("/getAccessToken", async (req, res) => {
  const response = await getAccessToken(req, res);
  res.json(response);
});

app.get("/userData", async (req, res) => {
  const deets = await getUserDetails(req, res);
  res.json(deets);
});

app.get("/getData", async (req, res) => {
  const deets = await queryVersionData(req, res);
  console.log(deets);
  res.json(deets);
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
