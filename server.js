require("dotenv").config();
const path = require("path");
const express = require("express");
const app = express();
const { getSheetData } = require("./googleAuth");
const {
  redirectToSalesforceLogin,
  getAccessToken,
  getUserDetails,
  queryVersionData,
} = require("./salesforceAuth");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { engine } = require("express-handlebars");
const PORT = process.env.PORT || 5000;

app.use(cookieParser());
app.use(
  cors({
    origin: "*",
  })
);
app.engine(".hbs", engine({ extname: ".hbs" }));
app.set("view engine", ".hbs");
app.set("views", "./views");

app.get("/", (_req, res) => {
  res.render("home", { title: true });
});

// ------------- Google Auth ------------------

app.get("/getSheetData", async (_req, res) => {
  const data = await getSheetData();
  console.log(data);
  res.send(data);
});

// ------------- Salesforce Auth ------------------

app.get("/salesforceAuth", async (req, res) => {
  const redirectUri = await redirectToSalesforceLogin(req, res);
  res.cookie("Revert Uri", req.query.revertUri).json({ redirectUri });
});

app.get("/getAccessToken", async (req, res) => {
  const response = await getAccessToken(req, res);
  let revert = req.cookies["Revert Uri"] ?? "/getData"; // "/getData?fileId=0685g00000DcR3wAAF";
  res.clearCookie("Revert Uri");
  res.cookie("Instance Url", response.INSTANCE_URL);
  res.cookie("Access Token", response.ACCESS_TOKEN).redirect(revert);
});

app.get("/userData", async (req, res) => {
  const deets = await getUserDetails(req, res);
  res.json(deets);
});

app.get("/getData", async (req, res) => {
  let fileId = req.query.fileId; // /getData?fileId=xxxx
  const deets = await queryVersionData(req, res, fileId);
  console.log(deets);
  // get file data
  let urlStr = deets.records[1].VersionData;
  try {
    const resp = await fetch(req.cookies["Instance Url"] + urlStr, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + req.cookies["Access Token"],
      },
    });
    const d = await resp.blob();
    const l = await d.text();
    console.log(l);
    res.send(l);
  } catch (error) {
    console.log(error);
  }

  // res.render("home", {
  //   deets,
  // });
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
