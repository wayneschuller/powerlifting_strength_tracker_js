// Helper functions for Google Sheets data integration

// This key pairing will only work from wayneschuller.github.io
// It authorises only a very minimal read only API range to get GSheets lifting history data
// If you fork the code you must use your own key.
const CLIENT_ID = "465438544924-pmnd9sp3r6tfghsr8psqim833v01et6m.apps.googleusercontent.com";
const API_KEY = 'AIzaSyB-NZ4iBxmKqdbl3pg3ythgssjsL4v9tjY';
const APP_ID = '465438544924';
const REFRESH_TIME = 10000; // How many milliseconds between refresh attempts of Google Sheet data

let modifiedTime = -1;
let tokenClient;
let accessToken = null;
let ssId;

// Called onload when html has sourced https://apis.google.com/js/api.js
function gapiLoaded() {
  gapi.load('client:picker', intializeGapiClient);
}

// Called onload when html has sourced https://accounts.google.com/gsi/client
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (tokenResponse) => {
	    accessToken = tokenResponse.access_token;
  	  createPicker();
    },
  });
}

// Generate methods for gapi.client.sheets
// Callback for when gapi.load has completed
const DISCOVERY_DOC = ["https://sheets.googleapis.com/$discovery/rest?version=v4", "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
function intializeGapiClient() {
  gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [DISCOVERY_DOC],
  });
}

// Handler function for HTML button "Load data from Google Sheets"
// Slightly lazy approach as we are meant to disable the button until the 
// gapi.load for picker has been succesful.
function loadGooglePicker() {
  tokenClient.requestAccessToken(); // If token is provided, the callback will load picker
}

// Once we have a token we can open a Google Drive picker
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

  // console.log(`Picker result: ${JSON.stringify(data, null, 2)}`);

  ssId = data.docs[0].id; // Select the first ID they picked
	
  chartTitle = `Google Sheet: ${data.docs[0].name}`;

  checkGoogleSheetModified(ssId);
}

// Check whether Google Sheet is modified and if so load the Google Sheet
function checkGoogleSheetModified (ssId) {

  // Get the modified time of the spreadsheet
  let request = gapi.client.drive.files.get({
 		fileId: ssId,
		fields: "modifiedTime",
  });
	
  request.then(function(response) {

	  if (modifiedTime == response.result.modifiedTime) {
			console.log (`Google Sheet metadata unchanged, no refresh needed`);
    	// Call this function again in a few seconds to auto refresh Google Sheet data
   		setTimeout(function run() { 
   			checkGoogleSheetModified(ssId);
   		}, REFRESH_TIME);
			return;
		}

	  // modifiedTime has changed.  Set new modifiedime and read Google Sheets data 
		console.log (`Metadata changed, refreshing google sheets data from ${ssId}`);
	  modifiedTime = response.result.modifiedTime;
		readGoogleSheetsData(ssId);

  }, function (errorResponse) {
  	// Gapi request error
  	console.error(`drive.files.get error: ${errorResponse.result.error.message}`);
  });
}


function readGoogleSheetsData (ssId) {
  console.log(`Ask google sheets for data from ${ssId}`); 

  // The user chose a spreadsheet, load the values via API
  let request = gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: ssId,
    range: 'A:Z', // grab enough columns to get everything for different data types
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  request.then(function(response) {
    // Gapi sheets get request successful
    if (myChart !== null) prepareDataRefresh(true);
    createChart(response.result.values);

    // Check again later to auto refresh Google Sheet data
    setTimeout(function run() { 
       checkGoogleSheetModified(ssId);
    }, REFRESH_TIME);

  }, function(errorResponse) {
    // Gapi request error
    console.error(`sheets.spreadsheets.values.get error: ${errorResponse.result.error.message}`);
  });
}