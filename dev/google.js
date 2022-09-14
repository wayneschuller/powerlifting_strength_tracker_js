// Helper functions for Google Drive/Sheets data integration

// This API key is linked only to the wayneschuller.github.io domain
// It has minimal API libraries enabled for picking and reading a Google Sheet
//const GOOGLE_API_KEY = "465438544924-pmnd9sp3r6tfghsr8psqim833v01et6m.apps.googleusercontent.com";


// Load up the gisButton for google authentication.
// We could bind this with a better UI
// window.onload = function () {
//     google.accounts.id.initialize({
//         // This API key is linked only to the wayneschuller.github.io domain
//         // It has minimal API libraries enabled for picking and reading a Google Sheet
//         client_id: GOOGLE_API_KEY,
//         callback: handleCredentialResponse
//     });

//     google.accounts.id.renderButton( 
//         document.getElementById("gisButton"),
//         { theme: "outline", size: "large" }  // customization attributes
//     );
//     //google.accounts.id.prompt(); // also display the One Tap dialog
// }


// callback for when user successfully authenticates via Google GIS
// function handleCredentialResponse(response) {
//     console.log("Encoded JWT ID token: " + response.credential);
// }

// Sample code from: https://developers.google.com/drive/picker/guides/sample 
  /* exported gapiLoaded */
  /* exported gisLoaded */
  /* exported handleAuthClick */
  /* exported handleSignoutClick */

  // Authorization scopes required by the API; multiple scopes can be
  // included, separated by spaces.
  const SCOPES = 'https://www.googleapis.com/auth/drive.metadata.readonly';

  // TODO(developer): Set to client ID and API key from the Developer Console
  const CLIENT_ID = "465438544924-pmnd9sp3r6tfghsr8psqim833v01et6m.apps.googleusercontent.com";
  const API_KEY = 'AIzaSyB-NZ4iBxmKqdbl3pg3ythgssjsL4v9tjY';

  // TODO(developer): Replace with your own project number from console.developers.google.com.
  const APP_ID = '465438544924';

  let tokenClient;
  let accessToken = null;
  let pickerInited = false;
  let gisInited = false;


  //document.getElementById('authorize_button').style.visibility = 'hidden';
  //document.getElementById('signout_button').style.visibility = 'hidden';

  /**
   * Callback after api.js is loaded.
   */
  function gapiLoaded() {
    gapi.load('picker', intializePicker);
  }

  /**
   * Callback after the API client is loaded. Loads the
   * discovery doc to initialize the API.
   */
  function intializePicker() {
    pickerInited = true;
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
    view.setMimeTypes('image/png,image/jpeg,image/jpg');
    const picker = new google.picker.PickerBuilder()
        //.enableFeature(google.picker.Feature.NAV_HIDDEN)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
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
    if (data.action === google.picker.Action.PICKED) {
        document.getElementById('content').innerText = JSON.stringify(data, null, 2);
        console.log(`Result: ${JSON.stringify(data, null, 2)}`);
    }
  }