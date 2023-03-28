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

app.get("/", (req, res) => {
  res.send("Hey!");
});

app.get("/getSheetData", async (_req, res) => {
  const data = await getSheetData();
  console.log(data);
  res.send(data);
});

app.get("/salesforceAuth", async (req, res) => {
  await redirectToSalesforceLogin(req, res);
});

app.get("/getAccessToken", async (req, res) => {
  getAccessToken(req, res);
  res.send("Authentication successful!");
});

app.get("/userData", async (req, res) => {
  const deets = await getUserDetails(req, res, "/userData");
  // console.log(deets);
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
