console.log('strength.js has been opened');

// Global variables
let workout_date_COL, completed_COL, exercise_name_COL, assigned_reps_COL, assigned_weight_COL, actual_reps_COL, actual_weight_COL, missed_COL, description_COL;

let graphData = []; // array of objects in charts.js friendly format (x, y, label)

function readCSV () {
    let reader = new FileReader; 

    reader.onload = function () {
            // FIXME - we can run papa parse at the higher file reader level with good features
            let data = Papa.parse(reader.result, { dynamicTyping: true });
            let columnNames = data.data[0];

            // Detect what kind of CSV file this is based on a sample of test columns
            if (columnNames[0] === "user_name" && columnNames[1] === "workout_id") {

                // console.log("this is bloc data CSV");
                parseBlocCSV(data.data);  

            } else if (columnNames[0] === "Date" && columnNames[4] === "Pukie") {

                // console.log("This is BTWB data CSV");
                parseBtwbCSV(data.data);  

            } else {
                console.error("Did not detect CSV format. Currently we only process CSV data from Barbell Logic Online Coaching app and Beyond the Whiteboard app");
            }

            // Draw the chart now we have data.
            let canvas = document.getElementById('myChart');
            const myChart = new Chart(canvas, getChartConfig());
    }
    // start reading the file. When it is done, calls the onload event defined above.
    reader.readAsBinaryString(fileInput.files[0]);
}

// Parse Beyond the Whiteboard app workout data CSV into the global graphData array
// Assumes a PapaParse data format - array of rows, each row an array of items 
function parseBtwbCSV(data) {

    let columnNames = data[0]; // header row

    // Here are the BTWB column names from their CSV export as of 2022
    const DATEFIELD = "Date";
    const DESCRIPTION = "Description";

    // Iterate through the header row and find our essential column indexes
    // We do not assume consistent column order.
    for (let col = 0; col < columnNames.length; col++) {

        // console.log("Column name is: %s (%s)", columnNames[col], col);
        switch (columnNames[col]) {
            case DATEFIELD:
                workout_date_COL = col;
                break;
            case DESCRIPTION:
                description_COL = col;
                break;
        }
    }

    if (workout_date_COL == undefined || description_COL == undefined) return; 
      
    console.log(`Excellent BTWB data set header row.`);

    let squatData = data.filter(isBtwbSquat); // filter for squat rows 
        
    graphData = squatData.map(processBtwbData); // convert every row best e1rm to chart.js style
        
    //console.log(`Created graphData: ${JSON.stringify(graphData)}`);
}

// Parse Barbell Logic app workout data CSV into the global graphData array
function parseBlocCSV(data) {
    let columnNames = data[0]; // header row

    // Here are the essential BLOC column names from their CSV export as of 2022
    const DATEFIELD = "workout_date";
    const COMPLETED = "workout_completed";
    const EXERCISENAME = "exercise_name";
    const ASSIGNEDREPS = "assigned_reps";
    const ASSIGNEDWEIGHT = "assigned_weight";
    const ACTUALREPS = "actual_reps";
    const ACTUALWEIGHT = "actual_weight";
    const MISSED = "assigned_exercise_missed"; 

    // Iterate through the header row find our column indexes
    // We do not assume consistent column order.
    for (let col = 0; col < columnNames.length; col++) {

        //console.log("Column name is: %s", columnNames[col]);
        switch (columnNames[col]) {
            case DATEFIELD:
            workout_date_COL = col;
            break;
        case COMPLETED:
            completed_COL = col;
            break;
        case EXERCISENAME:
            exercise_name_COL = col;
            break;
        case ASSIGNEDREPS:
            assigned_reps_COL = col;
            break;
        case ASSIGNEDWEIGHT:
            assigned_weight_COL = col;
            break;  
        case ACTUALREPS:
            actual_reps_COL = col;
            break;
        case ACTUALWEIGHT:
            actual_weight_COL = col;
            break;
        case MISSED:
            missed_COL = col;
        }
    }

    // Give up if we did not find all our expected BLOC data column names
    // FIXME: this should check for undefined explicitly - if any are column 0 then they will trigger this
    if (!workout_date_COL ||
        !completed_COL ||
        !exercise_name_COL ||
        !assigned_reps_COL ||
        !assigned_weight_COL ||
        !actual_reps_COL ||
        !actual_weight_COL) 
        return; 
      
    console.log("Excellent BLOC data set header row.");

    let lifts = data.filter(isBlocSquat); // get BLOC format squats with actual reps + weight

    graphData = lifts.map(processBlocData); // Process e1rms to chart.js style

    graphData = removeDupes(graphData); 

    // console.log(`CSV had ${data.length} rows with ${graphData.length} processed e1rm lifts.`);
}


// Take an array of graphData structs and if there are duplicates in a day keep only best lift
// Useful for Bloc data which has one lift per row.
// This code assumes only two lifts are entered per day (normally a topset and volume set)
// and that these two lifts will be neighbours in the array.
// FIXME: does it fail when 3 squats are recorded in the same day?
function removeDupes(arr) {

    let output = [];

    // Start looping with the second item
    // Compare current with previous pairs
    // If date is the same, pick a winner then jump forward twice (note the extra i++)
    // If the date is different just let the previous one be chosen 
    for (let i = 1; i < arr.length; i++) {
        if (arr[i].x === arr[i-1].x) 
            if (arr[i].y >= arr[i-1].y) {
                output.push(arr[i]); 
                i++;
            } else {
                output.push(arr[i-1]); 
                i++; 
            } 
        else output.push(arr[i-1]); // the dates are not equal, push the previous one
    }

    return output;
}

// Look for squat data in this BTWB format row 
function isBtwbSquat(row) {
    let regex = /(Back Squats)/gm;
    let result = regex.exec(row[description_COL]);
    // console.log(`isSquat: row: ${row}, regex result: ${result}`);

    if (result === null) return false; // Not a back squat
    else return true;
}

// Convert a BTWB row of data to an object for charts.js graph with our e1rms over time
function processBtwbData(row) {
    let lifted_reps = Math.floor(Math.random() * 5);
    let lifted_weight = Math.floor(Math.random() * 100) + 50;

    // console.log(`processBtwbData passed: ${row}`);

    if (row === undefined) {
            console.error("row undefined?");
            return []; // what to return when failure? null or []?
    }

    // Check for Squat
    let regex = /(Back Squats)/gm;
    let result = regex.exec(row[description_COL]);
    if (!result) return []; // Not a back squat

    let lifts = row[description_COL].split(/\r?\n/);

    // console.log(`Lifts is split into: ${JSON.stringify(lifts)}`);
   
    // Loop through the lifts of this session and find the best e1rm lift
    let oneRepMax = 0;
    for (let lift of lifts) {
        // console.log(`Procesing lift ${lift}`);

        // Get number of reps
        let regex = /^[0-9]+/gm;
        let result = regex.exec(lift);
        if (!result) continue;
        curReps = parseInt(result[0]);

        // Get weight
        regex = /[0-9|\.]+\skg$/gm; 
        result = regex.exec(lift);
        if (!result) continue;
        let curWeight = parseInt(result[0].slice(0, result[0].length-2)); // Remove the kg off the end
        
        // console.log(`discovered curReps: ${curReps}, curWeight: ${curWeight}`);

        let curMax = estimateE1RM(curReps, curWeight);
        if (curMax >= oneRepMax) {
            oneRepMax = curMax; 
            lifted_reps = curReps;
            lifted_weight = curWeight;
        }
    }

    if (oneRepMax === 0) {
        console.error("We did not find any lifts (oneRepMax still 0)");
        return [];
    }

    // console.log(`lifted_reps: ${lifted_reps}, lifted weight: ${lifted_weight}, e1rm: ${oneRepMax}`); 
    return {x:row[workout_date_COL], y: oneRepMax, label:`Estimated ${oneRepMax}kg from ${lifted_reps}@${lifted_weight}kg`};

}


// Convert a bloc row of data to an object for charts.js with e1rm
// Old:
// ['Wayne Schuller', '25079', '2021-06-16', 'true', 'workout', '', '3321.0', 'false', 'Bench Press', 'resistance', '', '3', 'standard', '3', 'standard', '118.0', 'standard', '', 'kg', '3', '3', '119.0']
// New:
// {x:'2021-06-16', y:130, label:'3@119kg'}
function processBlocData(row) {
    let lifted_reps = row[assigned_reps_COL];
    let lifted_weight = row[assigned_weight_COL];

    //console.log(`Processing row: ${row}`);
    //console.log(`Processing top: lifted_reps: ${lifted_reps}, lifted weight: ${lifted_weight}`); 

    // Override if there is an actual_reps and actual_weight as well
    // This happens when the person lifts different to what was assigned by their coach
    if (row[actual_reps_COL] && row[actual_weight_COL]) {
            lifted_reps = row[actual_reps_COL];
            lifted_weight = row[actual_weight_COL];
    }
    
    // Calculate 1RM for the set
    let onerepmax = estimateE1RM(lifted_reps, lifted_weight);
    // console.log(`lifted_reps: ${lifted_reps}, lifted weight: ${lifted_weight}, e1rm: ${onerepmax}`); 
    return {x:row[workout_date_COL], y: onerepmax, label:`Estimated ${onerepmax}kg from ${lifted_reps}@${lifted_weight}kg`};
}

// Return a rounded 1 rep max using Epley formula
// For theory see: https://en.wikipedia.org/wiki/One-repetition_maximum 
// Later on we can add different methods
// We really only need a method that works for 1-10 reps.
function estimateE1RM(reps, weight) {
    if (reps == 0) {
            console.error("Somebody passed 0 reps... naughty.");
            return 0;
    }
    if (reps == 1) return parseInt(weight); // FIXME: Preserve 1 decimal? Heavy single requires no estimate! 
    return Math.round(weight*(1+reps/30));
}


// Check a row of BLOC data to see if there is a valid lift in this row
// We basically will assume the row is valid unless it passes certain tests.
// The BLOC data format contains many rows that don't actually count as a lift
function isBlocSquat(row) {

    if (!row) return false;

    // Give up on this row if there is no date field (should never happen)
    if (!row[workout_date_COL]) return false;

    // Is it a squat?!
    if (row[exercise_name_COL] != "Squat") return false;

    // Give up on this row if it is not a completed workout
    if (!row[completed_COL]) return false;

    // Give up on this row if missed_COL is true 
    if (row[missed_COL] === true) return false;

    // Give up on this row if there is no assigned reps 
    // Happens when coach leaves comments in the app
    if (!row[assigned_reps_COL]) return false;

    // Reject if all the lifts are zeros
    if (row[assigned_weight_COL] === 0 && row[actual_weight_COL] === 0) return false;

    return true;
}


// Setup a charts.js chart.
// Function assumes the global variable graphData already contains array of charts.js object entries such as:
// {x:'2021-06-16', y:130, label:'3@119kg'}
function getChartConfig () {
    const data = {
      datasets: [{
        label: 'Squat Progress',
        backgroundColor: 'rgb(255, 0, 0)',
        borderColor: 'rgb(50, 50, 50)',
        borderWidth: 3,
        pointStyle: 'circle',
        radius: 4,
        hitRadius: 15,
        hoverRadius: 10,
        cubicInterpolationMode: 'monotone',
        data: graphData,
      }]
    };

    let delayed;

    const config = {
        type: 'line',
        plugins: [ChartDataLabels],
        data: data,
        options: {
            animations: {
                onComplete: () => {
                    delayed = true;
                },
                delay: (context) => {
                    let delay = 0;
                    if (context.type === 'data' && context.mode === 'default' && !delayed) {
                        delay = context.dataIndex * 8000;
                    }
                    return delay;
                },
            },
            plugins: {
                zoom: {
                    zoom: {
                        wheel: { 
                            enabled: true,
                        },
                        pinch: {
                            enabled: true,
                        },
                        mode: 'xy',
                    },
                    pan: {
                        enabled: true,
                    },
                    mode: 'xy',
                },
                datalabels: {
                    formatter: function(context) {
                        return context.y; 
                        },
                    font: { weight: 'bold'},
                    align: 'end',
                    anchor: 'end',
                },
                tooltip: {
                    enabled: true,
                    position: 'nearest',
                    callbacks: {
                            label: function(context) {
                                // console.log(`inside tooltip callback`);
                                return data.datasets[context.datasetIndex].data[context.dataIndex].label;
                            },
                    }
                },
                legend: {
                    labels: {
                        font: {
                            size:16
                        }
                    }
                }
            },
            scales: {
                    xAxis: {
                        type: 'time',
                        time: {
                            unit: 'quarter'
                        }
                    },
                //yAxis: {min: 0, max: 250}
            },

        }
    };
    return config;
}
