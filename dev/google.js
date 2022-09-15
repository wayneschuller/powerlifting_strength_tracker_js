// Helper functions for Google Drive/Sheets data integration

// Based on sample code from: https://developers.google.com/drive/picker/guides/sample 

  // Authorization scopes required by the API; multiple scopes can be
  // included, separated by spaces.
  const SCOPES = 'https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/spreadsheets.readonly';

  // This key pairing will only work from wayneschuller.github.io
  // If you fork the code you must use your own key.
  const CLIENT_ID = "465438544924-pmnd9sp3r6tfghsr8psqim833v01et6m.apps.googleusercontent.com";
  const API_KEY = 'AIzaSyB-NZ4iBxmKqdbl3pg3ythgssjsL4v9tjY';

  // TODO(developer): Replace with your own project number from console.developers.google.com.
  const APP_ID = '465438544924';
  const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';


  let tokenClient;
  let accessToken = null;
  let pickerInited = false;
  let gapiInited = false;
  let gisInited = false;


  //document.getElementById('authorize_button').style.visibility = 'hidden';
  //document.getElementById('signout_button').style.visibility = 'hidden';

  /**
   * Callback after api.js is loaded.
   */
  function gapiLoaded() {
    gapi.load('picker', intializePicker);
    gapi.load('client', intializeGapiClient);
  }

  /**
   * Callback after the API client is loaded. Loads the
   * discovery doc to initialize the API.
   */
  function intializePicker() {
    pickerInited = true;
    maybeEnableButtons();
  }


  function intializeGapiClient() {
      gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        maybeEnableButtons();
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
    maybeEnableButtons();
  }

  /**
   * Enables user interaction after all libraries are loaded.
   */
  function maybeEnableButtons() {
    if (pickerInited && gisInited) {
      document.getElementById('authorize_button').style.visibility = 'visible';
    }
  }

  /**
   *  Sign in the user upon button click.
   */
  function handleAuthClick() {
    tokenClient.callback = async (response) => {
      if (response.error !== undefined) {
        throw (response);
      }
      accessToken = response.access_token;
      document.getElementById('signout_button').style.visibility = 'visible';
      document.getElementById('authorize_button').innerText = 'Refresh';
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

  /**
   *  Sign out the user upon button click.
   */
  function handleSignoutClick() {
    if (accessToken) {
      accessToken = null;
      google.accounts.oauth2.revoke(accessToken);
      document.getElementById('content').innerText = '';
      document.getElementById('authorize_button').innerText = 'Authorize';
      document.getElementById('signout_button').style.visibility = 'hidden';
    }
  }

  /**
   *  Create and render a Picker object for searching images.
   */
  function createPicker() {
    const view = new google.picker.View(google.picker.ViewId.SPREADSHEETS);
    //view.setMimeTypes('image/png,image/jpeg,image/jpg');
    const picker = new google.picker.PickerBuilder()
        .setDeveloperKey(API_KEY)
        .setAppId(APP_ID)
        .setOAuthToken(accessToken)
        .addView(view)
        .addView(new google.picker.DocsUploadView())
        .setCallback(pickerCallback)
        .build();
    picker.setVisible(true);
  }

  /**
   * Displays the file details of the user's selection.
   * @param {object} data - Containers the user selection from the picker
   */
  function pickerCallback(data) {
    if (data.action !== google.picker.Action.PICKED) return; // nothing picked

    console.log(`Result: ${JSON.stringify(data, null, 2)}`);

    ssId = data.docs[0].id;
    console.log(`attempting to load id: ${ssId}`);

    // The user chose a spreadsheet, load the values via API
    let request = gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: ssId,
        range: 'A:Z', // grab enough columns to get everything for different data types
        dateTimeRenderOption: 'FORMATTED_STRING',
    });

    request.then(function(response) {

        console.log(`GSheet data loaded: ${response.result}`);

        // We have the google sheet data.
        createChart(response.result.values);
    }, function(reason) {
        console.error(`error: ${reason.result.error.message}`);
    });
}