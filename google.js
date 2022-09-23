// Helper functions for Google Drive/Sheets data integration

const SCOPES = 'https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/spreadsheets.readonly';

// This key pairing will only work from wayneschuller.github.io
// If you fork the code you must use your own key.
const CLIENT_ID = "465438544924-pmnd9sp3r6tfghsr8psqim833v01et6m.apps.googleusercontent.com";
const API_KEY = 'AIzaSyB-NZ4iBxmKqdbl3pg3ythgssjsL4v9tjY';
const APP_ID = '465438544924';
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

let tokenClient;
let accessToken = null;
let pickerInited = false;
let gapiInited = false;
let gisInited = false;
let ssId;

/**
 * Callback after api.js is loaded.
 */
function gapiLoaded() {
  gapi.load('picker', intializePicker);
  gapi.load('client', intializeGapiClient);
}

/**
 * Callback after Google Identity Services are loaded.
 */
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '', // defined later
  });
  gisInited = true;
}

/**
 * Callback after the API client is loaded. Loads the
 * discovery doc to initialize the API.
 */
function intializePicker() {
  pickerInited = true;
}


function intializeGapiClient() {
    gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
}


/**
 *  Sign in the user upon button click and call createPicker to choose a google sheet
 */
function loadGooglePicker() {
  tokenClient.callback = async (response) => {
    if (response.error !== undefined) {
    throw (response);
    }
    accessToken = response.access_token;
    await createPicker();
  };

  if (accessToken === null) {
    // Prompt the user to select a Google Account and ask for consent to share their data
    // when establishing a new session.
    tokenClient.requestAccessToken({prompt: 'consent'});
  } else {
    // Skip display of account chooser and consent dialog for an existing session.
    tokenClient.requestAccessToken({prompt: ''});
  }
}

function createPicker() {
  const picker = new google.picker.PickerBuilder()
    .setDeveloperKey(API_KEY)
    .setAppId(APP_ID)
    .setOAuthToken(accessToken)
    .addView(google.picker.ViewId.SPREADSHEETS)
    .setCallback(pickerCallback)
    .build();
  picker.setVisible(true);
}

// Get the google sheet the user picked and load the columns in the first sheet
function pickerCallback(data) {
  if (data.action !== google.picker.Action.PICKED) return; // nothing picked

  console.log(`Result: ${JSON.stringify(data, null, 2)}`);

  ssId = data.docs[0].id; // Select the first ID they picked
  chartTitle = `Google Sheet: ${data.docs[0].name}`;

  readGoogleSheetsData(ssId);
}

function readGoogleSheetsData (ssId) {
  console.log(`Ask google sheets for data.`); 

  // The user chose a spreadsheet, load the values via API
  let request = gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: ssId,
    range: 'A:Z', // grab enough columns to get everything for different data types
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  request.then(function(response) {
    // We have the google sheet data

    if (myChart !== null) prepareDataRefresh(true);
    createChart(response.result.values);

    // Call this function again in 20 seconds
    setTimeout(function run() { 
       readGoogleSheetsData(ssId);
    }, 20000);
  }, function(reason) {
    console.error(`error: ${reason.result.error.message}`);
  });
}