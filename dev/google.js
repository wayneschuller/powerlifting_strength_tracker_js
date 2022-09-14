// Helper functions for Google Drive/Sheets data integration

// This API key is linked only to the wayneschuller.github.io domain
// It has minimal API libraries enabled for picking and reading a Google Sheet
const GOOGLE_API_KEY = "465438544924-pmnd9sp3r6tfghsr8psqim833v01et6m.apps.googleusercontent.com";


// Load up the gisButton for google authentication.
// We could bind this with a better UI
window.onload = function () {
    google.accounts.id.initialize({
        // This API key is linked only to the wayneschuller.github.io domain
        // It has minimal API libraries enabled for picking and reading a Google Sheet
        client_id: GOOGLE_API_KEY,
        callback: handleCredentialResponse
    });

    google.accounts.id.renderButton( 
        document.getElementById("gisButton"),
        { theme: "outline", size: "large" }  // customization attributes
    );
    //google.accounts.id.prompt(); // also display the One Tap dialog
}


// callback for when user successfully authenticates via Google GIS
function handleCredentialResponse(response) {
    console.log("Encoded JWT ID token: " + response.credential);

    const showPicker = () => {
        // TODO(developer): Replace with your API key
        const picker = new google.picker.PickerBuilder()
            .addView(google.picker.ViewId.DOCS)
            .setOAuthToken(response.credential)
            .setDeveloperKey(GOOGLE_API_KEY)
            .setCallback(pickerCallback)
            .build();
        picker.setVisible(true);
    }
}

 // A simple callback implementation.
 function pickerCallback(data) {
    let url = 'nothing';
    if (data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
      let doc = data[google.picker.Response.DOCUMENTS][0];
      url = doc[google.picker.Document.URL];
    }
    let message = `You picked: ${url}`;
    // document.getElementById('result').innerText = message;
    console.log(message);
  }
