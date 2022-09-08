// importers.js
// Wayne Schuller, wayne@schuller.id.au, 2022. GPL3 License.

// Globals (FIXME: remove some time)
let workout_date_COL, workout_id_COL, completed_COL, exercise_name_COL, assigned_reps_COL, assigned_weight_COL, actual_reps_COL, actual_weight_COL, missed_COL, description_COL, units_COL, notes_COL, url_COL;

let lastDate = "1999-12-31";
let lastLiftType = "Tik Tok Dancing"; 

// ----------------------------------------------------------------------
// parseCSV(data)
// Determine the CSV data format, parse into a rawLiftData array 
// ----------------------------------------------------------------------
function parseCSV(data) {

    // More than 10 errors might indicate it's a jpg or something non CSV
    if (data.meta.aborted || data.errors.length > 10) {
        console.error("Papaparse detected too many errors in file input. Do you even lift?")
        return null;
    }

    let rawLiftData = []; 

    let columnNames = data.data[0];

    // Look for distinctive BTWB CSV data columns - no one else will have a Pukie column
    if (columnNames[0] === "Date" && columnNames[4] === "Pukie") {
        // Dynamically find where all our needed columns are 
        workout_date_COL = columnNames.indexOf("Date");
        description_COL = columnNames.indexOf("Description");

        // FIXME: Should we check for missing columns here?

        data.data.forEach(parseBtwbRow, rawLiftData);
        return rawLiftData;
    } 

    // Look for distinctive BLOC CSV data columns
    if (columnNames[0] === "user_name" && columnNames[1] === "workout_id") {

        // Dynamically find where all our needed columns are 
        workout_date_COL = columnNames.indexOf("workout_date");
        workout_id_COL = columnNames.indexOf("workout_id");
        completed_COL = columnNames.indexOf("workout_completed");
        exercise_name_COL = columnNames.indexOf("exercise_name");
        assigned_reps_COL = columnNames.indexOf("assigned_reps");
        assigned_weight_COL = columnNames.indexOf("assigned_weight");
        actual_reps_COL = columnNames.indexOf("actual_reps");
        actual_weight_COL = columnNames.indexOf("actual_weight");
        missed_COL = columnNames.indexOf("assigned_exercise_missed");
        units_COL = columnNames.indexOf("weight_units");

        // FIXME: Should we check for missing columns here?

        data.data.forEach(parseBlocRow, rawLiftData);
        return rawLiftData;
    } 
   

    // From here let's just assume it is our bespoke CSV format
    // FIXME: URL link to public Google Sheet sample
    console.log(`Hello bespoke`);
    workout_date_COL = columnNames.indexOf("Date");
    exercise_name_COL = columnNames.indexOf("Lift Type");
    actual_reps_COL = columnNames.indexOf("Reps");
    actual_weight_COL = columnNames.indexOf("Weight");
    notes_COL = columnNames.indexOf("Notes");
    url_COL = columnNames.indexOf("URL");

    data.data.forEach(parseBespokeRow, rawLiftData);
    return rawLiftData;
}

// ---------------------------------------------------------------------------------
// Array method to parse a row of Bespoke data as a liftEntry object into rawLiftData
// Pass the destination array as an extra argument: sourceCSV.forEach(parseBtwbRow, rawLiftData);
// Goal is to make this as flexible as possible - it will be our main use case.
// ---------------------------------------------------------------------------------
function parseBespokeRow(row, index) {

    /*
    if (!row || row[0] === null) {
            // console.log(`parseBlocRow skipping bad row: ${JSON.stringify(row)}`);
            return; 
    }
    */

    // console.log(`Bespoke row ${index}: ${JSON.stringify(row)}`);

    if (row[actual_reps_COL] === "Reps") return false; // Probably header row

    let date = row[workout_date_COL];
    // If date is null we need to use the previous date in the dataset
    if (date === null) date = lastDate;
        else lastDate = date; // Remember good date in case we need it in a later row

    let liftType = row[exercise_name_COL];
    // If lift type is null we need to use the previous lift type
    if (liftType === null) liftType = lastLiftType;
        else lastLiftType = liftType; // Remember good life type in case we need it in a later row

    if (!row[actual_reps_COL] || !row[actual_weight_COL]) return false; // Do they even lift?

    let reps = row[actual_reps_COL];

    // Default will be to assume a raw number that is in pounds
    let weight = row[actual_weight_COL];
    // Look for units inside the weight string 
    if (row[actual_weight_COL].indexOf("kg") != -1) {

        unitType = "kg";

        // Convert weight to integer
        // FIXME: this might lose 0.5kg amounts?
        weight = parseInt(weight.slice(0, weight.length-2)); // Remove the units from the end

    } else if (row[actual_weight_COL].indexOf("lb") != -1) {

        unitType = "lb";

        // Convert weight to integer
        weight = parseInt(weight.slice(0, weight.length-2)); // Remove the units from the end
    } 

    if (reps === 0 || weight === 0) return false; // Do they even lift?

    // If we don't have these fields put in empty strings
    let url = row[url_COL]; if (!url) url = '';
    let notes = row[notes_COL]; if (!notes) notes = '';

    let liftEntry = {
        date: date,
        name: liftType,
        reps: reps,
        weight: weight,
        units: unitType, 
        notes: notes,
        url: url,
    }

    // console.log (`Pushing liftEntry: ${JSON.stringify(liftEntry)}`);

    rawLiftData = this.valueOf(); // Grab the extra array that was passed to the function
    rawLiftData.push(liftEntry); // add to our collection of raw data
}

// --------------------------------------------------------------------------------
// Array method to pass a row of BTWB data as a liftEntry object into rawLiftData
// Pass the destination array as an extra argument: sourceCSV.forEach(parseBtwbRow, rawLiftData);
// --------------------------------------------------------------------------------
function parseBtwbRow(row) {

    // console.log(`parseBtwbRow: ${JSON.stringify(row)}`);

    if (!row || row[0] === null) {
            // console.log(`processBtwbRow skipping bad row: ${JSON.stringify(row)}`);
            return; 
    }

    // Find the exercise name AKA type of lift in this row
    let regex = /[a-zA-Z ]*/gm;
    let result = regex.exec(row[1]); // Second column has the description - FIXME: use const column index format
    let liftType = result[0].trim();

    if (liftType === "") {
        console.log("liftType was empty string, probably a metcon");
        return;
    }

    // Loop through the lifts of this session and push them all to rawLiftData
    let lifts = row[description_COL].split(/\r?\n/); // BTWB has newlines inside the one cell entry
    for (let lift of lifts) {
        // console.log(`Procesing lift ${lift}`);

        // Get number of reps
        let regex = /^[0-9]+/gm;  
        let result = regex.exec(lift);
        if (!result) continue;
        let curReps = parseInt(result[0]);
        if (curReps == 0) continue; // FIXME: check why this would happen

        // Get units then weight
        if (lift.indexOf("kg") != -1) {
            unitType = "kg";
            regex = /[0-9|\.]+\skg$/gm; 
        } else if (lift.indexOf("lb") != -1) {
            unitType = "lb";
            regex = /[0-9|\.]+\slb$/gm; 
        } else continue; // We can't find units so it's probably not a lift 

        result = regex.exec(lift);
        if (!result) continue;
        let curWeight = parseInt(result[0].slice(0, result[0].length-2)); // Remove the units (kg or lb) from the end
        if (curWeight == 0) continue;
        
        let liftEntry = {
            date: row[workout_date_COL],
            name: liftType,
            reps: curReps,
            weight: curWeight,
            units: unitType, 
            notes: '',
            url: '',
            // FIXME: add BTWB notes here
        }

        rawLiftData = this.valueOf(); // Grab the extra array that was passed to the function
        rawLiftData.push(liftEntry); // add to our collection of raw data
    }
}


// ---------------------------------------------------------------------------------
// Array method to parse a row of BLOC data as a liftEntry object into rawLiftData
// Pass the destination array as an extra argument: sourceCSV.forEach(parseBtwbRow, rawLiftData);
// ---------------------------------------------------------------------------------
function parseBlocRow(row) {

    if (!row || row[0] === null) {
            // console.log(`parseBlocRow skipping bad row: ${JSON.stringify(row)}`);
            return; 
    }

    if (row[actual_reps_COL] === "actual_reps") return false; // Probably header row

    // Give up on this row if it is not a completed workout
    if (!row[completed_COL]) return false;

    // Give up on this row if missed_COL is true 
    if (row[missed_COL] === true) return false;

    // Give up on this row if there are no assigned reps 
    // Happens when a BLOC coach leaves comments in the web app
    if (!row[assigned_reps_COL]) return false;

    let lifted_reps = row[assigned_reps_COL];
    let lifted_weight = row[assigned_weight_COL];

    // Override if there is an actual_reps and actual_weight as well
    // This happens when the person lifts different to what was assigned by their coach
    if (row[actual_reps_COL] && row[actual_weight_COL]) {
            lifted_reps = row[actual_reps_COL];
            lifted_weight = row[actual_weight_COL];
    }
   
    if (lifted_reps === 0 || lifted_weight === 0) return;

    unitType = row[units_COL]; // Record the units type global for later. (we assume it won't change in the CSV)

    let liftUrl = `https://www.barbelllogic.app/workout/${row[workout_id_COL]}`;

    let liftEntry = {
        date: row[workout_date_COL],
        name: row[exercise_name_COL],
        reps: lifted_reps,
        weight: lifted_weight,
        url: liftUrl,
        units: unitType, 
        notes: '',
        // FIXME: any BLOC notes to add?
    }

    rawLiftData = this.valueOf(); // Grab the extra array that was passed to the function
    rawLiftData.push(liftEntry); // add to our collection of raw data
}

// Export the current rawLiftData to the user in a CSV format.
function exportRawCSV () {
    console.log(`let's export some raw csv data`);

    let csvContent = "data:text/csv;charset=utf-8,";

    csvContent += `Date,"Lift Type",Reps,Weight,Notes,URL` + "\r\n"; // header row

    rawLiftData.forEach(function(lift) {
        let row = `${lift.date},${lift.name},${lift.reps},${lift.weight}${lift.units},${lift.notes},${lift.url}`;
        csvContent += row + "\r\n";
    });

    var encodedUri = encodeURI(csvContent);
    window.open(encodedUri);
}