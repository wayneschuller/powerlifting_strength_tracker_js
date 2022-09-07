// importers.js
// Wayne Schuller, wayne@schuller.id.au, 2022. GPL3 License.

// Globals (FIXME: remove some time)
let workout_date_COL, workout_id_COL, completed_COL, exercise_name_COL, assigned_reps_COL, assigned_weight_COL, actual_reps_COL, actual_weight_COL, missed_COL, description_COL, units_COL;

// ----------------------------------------------------------------------
// parseCSV(data)
// Determine the data format, parse into a rawLiftData array 
// ----------------------------------------------------------------------
function parseCSV(data) {

    let rawLiftData = []; 

    let columnNames = data.data[0];
    // Detect what kind of CSV file this is based on a sample of test columns in the first row
    if (columnNames[0] === "user_name" && columnNames[1] === "workout_id") {

        // console.log("this is bloc data CSV");
        // Here are the essential BLOC column names from their CSV export as of 2022
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

        data.data.forEach(parseBlocRow, rawLiftData);

    } else if (columnNames[0] === "Date" && columnNames[4] === "Pukie") {

        // console.log("This is BTWB data CSV");
        workout_date_COL = columnNames.indexOf("Date");
        description_COL = columnNames.indexOf("Description");
        data.data.forEach(parseBtwbRow, rawLiftData);

    } else {
        console.error("Did not detect CSV format. Currently we only process CSV data from Barbell Logic Online Coaching app and Beyond the Whiteboard app");
    }

    return rawLiftData;
}
// ----------------------------------------------------------------------
// Parse a row of BTWB data as a liftEntry object into rawLiftData
// ----------------------------------------------------------------------
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
            name: liftType,
            date: row[workout_date_COL],
            reps: curReps,
            weight: curWeight,
            units: unitType, 
        }

        rLiftData = this.valueOf(); // Grab the extra array that was passed to the function
        rLiftData.push(liftEntry); // add to our collection of raw data
    }
}


// ----------------------------------------------------------------------
// Parse a row of BLOC data as a liftEntry object into rawLiftData
// ----------------------------------------------------------------------
function parseBlocRow(row) {

    if (!row || row[0] === null) {
            // console.log(`parseBlocRow skipping bad row: ${JSON.stringify(row)}`);
            return; 
    }

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

    let liftURL = `https://www.barbelllogic.app/workout/${row[workout_id_COL]}`;

    let liftEntry = {
        name: row[exercise_name_COL],
        date: row[workout_date_COL],
        reps: lifted_reps,
        weight: lifted_weight,
        URL: liftURL,
    }

    rLiftData = this.valueOf(); // Grab the extra array that was passed to the function
    rLiftData.push(liftEntry); // add to our collection of raw data
}
