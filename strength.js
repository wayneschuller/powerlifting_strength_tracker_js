// Global variables
let workout_date_COL, completed_COL, exercise_name_COL, assigned_reps_COL, assigned_weight_COL, actual_reps_COL, actual_weight_COL, missed_COL, description_COL;

let rawLiftData = []; // Array of lift objects
let processedData = []; // Array with one element per lift type of charts.js graph friendly data and special achievements 

function readCSV () {
    let reader = new FileReader; 
    
    reader.onload = function () {
            let data = Papa.parse(reader.result, { dynamicTyping: true });
            let columnNames = data.data[0];

            // Detect what kind of CSV file this is based on a sample of test columns in the first row
            if (columnNames[0] === "user_name" && columnNames[1] === "workout_id") {

                // console.log("this is bloc data CSV");
                // Here are the essential BLOC column names from their CSV export as of 2022
                workout_date_COL = columnNames.indexOf("workout_date");
                completed_COL = columnNames.indexOf("workout_completed");
                exercise_name_COL = columnNames.indexOf("exercise_name");
                assigned_reps_COL = columnNames.indexOf("assigned_reps");
                assigned_weight_COL = columnNames.indexOf("assigned_weight");
                actual_reps_COL = columnNames.indexOf("actual_reps");
                actual_weight_COL = columnNames.indexOf("actual_weight");
                missed_COL = columnNames.indexOf("assigned_exercise_missed");
                data.data.forEach(parseBlocRow);

            } else if (columnNames[0] === "Date" && columnNames[4] === "Pukie") {

                // console.log("This is BTWB data CSV");
                workout_date_COL = columnNames.indexOf("Date");
                description_COL = columnNames.indexOf("Description");
                data.data.forEach(parseBtwbRow);

            } else {
                console.error("Did not detect CSV format. Currently we only process CSV data from Barbell Logic Online Coaching app and Beyond the Whiteboard app");
            }

            // We now have the rawLiftData from various sources.
            // Process that data into our processedData structure
            processRawLiftData();

            // Every element of processedData has a graphData array
            // Sort our processed data so the most popular lift types are at the beginning
            processedData.sort((a, b)=> b.graphData.length - a.graphData.length);

            // Draw the chart now we have data.
            let canvas = document.getElementById('myChart');
            const myChart = new Chart(canvas, getChartConfig());
    }

    // Start reading the file. When it is done, calls the onload event defined above.
    reader.readAsText(fileInput.files[0]);
}

// Process the RawLiftData array of lifts into charts.js compatible graphdata.
// FIXME: use this function to collect achievements to share with the user (5RM, 1RM per lift etc)
function processRawLiftData() {

    for (let i = 0; i < rawLiftData.length; i++) {
        let index = processedData.findIndex(lift => lift.name === rawLiftData[i].name);
        // console.log(`Index is ${JSON.stringify(index)}`);

        if (index === -1) {
            let processedLiftType = {
                name: rawLiftData[i].name,
                graphData: [],
                best5RM: null,
                best3RM: null,
                best1RM: null
            };
            index = processedData.push(processedLiftType) - 1;
        }
        
        let oneRepMax = estimateE1RM(rawLiftData[i].reps, rawLiftData[i].weight);
        // Do we already have a processed same lift on this same date at the end of the array?
        // FIXME: this should really search the whole array for the date anywhere
        // console.log(`processedData[index].graphData: ${processedData[index].graphData}`); 

        if (processedData[index].graphData.at(-1) && 
            rawLiftData[i].date === processedData[index].graphData.at(-1).x) { 
            // console.log(`We did this lift today already...`);
            
            if (oneRepMax > processedData[index].graphData.at(-1).y) {
                // Get rid of the old process data so we can push a bigger one on
                processedData[index].graphData.pop();
            } else continue;
        }

        // Push a new graphData item for this lift type.
        let label = '';
        if (rawLiftData[i].reps === 1)
            label = `Lifted 1@${rawLiftData[i].weight}kg`;
        else
            label = `Potential 1@${oneRepMax}kg from ${rawLiftData[i].reps}@${rawLiftData[i].weight}kg`;

        processedData[index].graphData.push({x:rawLiftData[i].date, y: oneRepMax, label:`${label}`});
    }
    console.log(`We now have ${processedData.length} types of lifts`);
}

// Load the BLOC data as a liftEntry object into rawLiftData
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

        // Get weight
        regex = /[0-9|\.]+\skg$/gm; 
        result = regex.exec(lift);
        if (!result) continue;
        let curWeight = parseInt(result[0].slice(0, result[0].length-2)); // Remove the kg off the end
        if (curWeight == 0) continue;
        
        let liftEntry = {
            name: liftType,
            date: row[workout_date_COL],
            reps: curReps,
            weight: curWeight,
            // FIXME: add units here
        }

        rawLiftData.push(liftEntry); // add to our collection of raw data
    }
}


// Parse a row of BLOC data as a liftEntry object into rawLiftData
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

    let liftEntry = {
        name: row[exercise_name_COL],
        date: row[workout_date_COL],
        reps: lifted_reps,
        weight: lifted_weight,
        // FIXME: add units here
    }
    rawLiftData.push(liftEntry); // add to our collection of raw data
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


// Setup a charts.js chart.
function getChartConfig () {

    colors = ['rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(0, 0, 255)', 'rgb(100, 100, 0)', 'rgb(0, 100, 100)'];

    // Make line config datasets of the most popular lift types
    let numGraphLines = 4;
    let dataSets = [];
    for (let i = 0; i < numGraphLines; i++) {
        dataSets.push({
            label: processedData[i].name,
            backgroundColor: colors[i],
            borderColor: 'rgb(50, 50, 50)',
            borderWidth: 3,
            pointStyle: 'circle',
            radius: 4,
            hitRadius: 15,
            hoverRadius: 10,
            cubicInterpolationMode: 'monotone',
            data: processedData[i].graphData,
        });
    }
        
    const data = {
        datasets: dataSets, 
    };

    const zoomOptions = {
        limits: {
            // FIXME: we can work out sensible values from our data set
            // x: {min: '2015-09-01', max: '2022-08-30', minRange: 50},
            // y: {min: 0, max: 250, minRange: 50}
            x: {min: 'original', max: 'original', minRange: 50},
            y: {min: 'original', max: 'original', minRange: 100},
        },
        pan: {
            enabled: true,
            mode: 'xy',
        },
        zoom: {
            wheel: {
            enabled: true,
        },
            pinch: {
            enabled: true
        },
            mode: 'xy',
            onZoomComplete({chart}) {
            // This update is needed to display up to date zoom level in the title.
            // Without this, previous zoom level is displayed.
            // The reason is: title uses the same beforeUpdate hook, and is evaluated before zoom.
            //chart.update('none');
            }
        }
    }

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
                zoom: zoomOptions,
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
                        title: function(context) {
                            const d = new Date(context[0].parsed.x)
                            const formattedDate = d.toLocaleString([], {
                                year:   'numeric',
                                month:  'long',
                                day:   'numeric',
                            })
                           return(formattedDate);
                        },
                        label: function(context) {
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
                    },
                    ticks: {
                        showLabelBackdrop: true
                    }
                },
                yAxis: {
                    suggestedMin: 50, 
                    suggestedMax: 225
                }
            },

        }
    };
    return config;
}