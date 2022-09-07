// Global variables
let workout_date_COL, workout_id_COL, completed_COL, exercise_name_COL, assigned_reps_COL, assigned_weight_COL, actual_reps_COL, actual_weight_COL, missed_COL, description_COL, units_COL;

const rawLiftData = []; // Array of lift objects
const processedData = []; // Array with one element per lift type of charts.js graph friendly data and special achievements 
const liftAnnotations = {}; 
let myChart; 
let numChartLines = 4; // How many lifts to show by default (FIXME: make configurable in the html)
let padDateMin, padDateMax;
let unitType = "lb"; // Default to freedom units

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
                workout_id_COL = columnNames.indexOf("workout_id");
                completed_COL = columnNames.indexOf("workout_completed");
                exercise_name_COL = columnNames.indexOf("exercise_name");
                assigned_reps_COL = columnNames.indexOf("assigned_reps");
                assigned_weight_COL = columnNames.indexOf("assigned_weight");
                actual_reps_COL = columnNames.indexOf("actual_reps");
                actual_weight_COL = columnNames.indexOf("actual_weight");
                missed_COL = columnNames.indexOf("assigned_exercise_missed");
                units_COL = columnNames.indexOf("weight_units");
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
            processRawLiftData("Brzycki");

            // Draw or update the chart now we have data.
            if (myChart) {
                myChart.update();
            } else {
                let canvas = document.getElementById('myChartCanvas');
                myChart = new Chart(canvas, getChartConfig());
            }
            // Process achievements and display them after creation
            processedData.forEach(visualiseAchievements, "Brzycki");
            myChart.update();

            // Now we have the chart show the controls box.
            let controlsBox = document.getElementById("chartControlsBox");
            controlsBox.style.visibility = "visible";
    }

    // Start reading the file. When it is done, calls the onload event defined above.
    reader.readAsText(fileInput.files[0]);
}

// Process the RawLiftData array of lifts into charts.js compatible graphdata.
// We also use this function to collect achievements to share with the user (5RM, 1RM per lift etc)
// Passed an string argument for equation - matching those in estimateE1RM() function.
function processRawLiftData(equation) {

    for (let i = 0; i < rawLiftData.length; i++) {

        let liftIndex = processedData.findIndex(lift => lift.name === rawLiftData[i].name);
        // console.log(`Index is ${JSON.stringify(index)}`);
        if (liftIndex === -1) { 
            let processedLiftType = { 
                name: rawLiftData[i].name, 
                graphData: [], 
                best5RM: null, 
                best3RM: null, 
                best1RM: null 
            }; 
        liftIndex = processedData.push(processedLiftType) - 1; 
        } 

        // Side task - collect some achievements for this lift type
        switch (rawLiftData[i].reps) {
            case 5:
                if (processedData[liftIndex].best5RM === null || rawLiftData[i].weight > processedData[liftIndex].best5RM.weight) 
                        processedData[liftIndex].best5RM = rawLiftData[i];
                break;
            case 3:
                if (processedData[liftIndex].best3RM === null || rawLiftData[i].weight > processedData[liftIndex].best3RM.weight) 
                        processedData[liftIndex].best3RM = rawLiftData[i];
                break;
            case 1:
                if (processedData[liftIndex].best1RM === null || rawLiftData[i].weight > processedData[liftIndex].best1RM.weight) 
                        processedData[liftIndex].best1RM = rawLiftData[i];
                break;
        }
        
        // Main task - find the best e1rm estimate on this date
        let oneRepMax = estimateE1RM(rawLiftData[i].reps, rawLiftData[i].weight, equation);

        // Prepare our data label
        let label = '';
        if (rawLiftData[i].reps === 1)
            label = `Lifted 1@${rawLiftData[i].weight}${unitType}.`;
        else
            label = `Potential 1@${oneRepMax}${unitType} from ${rawLiftData[i].reps}@${rawLiftData[i].weight}${unitType}.`;

        // Do we already have any processed data on this date?
        let dateIndex = processedData[liftIndex].graphData.findIndex(lift => lift.x === rawLiftData[i].date);
        if (dateIndex === -1) {
            // Push new lift on this new date (in chartjs friendly format)
            processedData[liftIndex].graphData.push(
                {   
                    x:rawLiftData[i].date, 
                    y: oneRepMax, 
                    label:`${label}`, 
                    URL:`${rawLiftData[i].URL}`,
                    method: `${equation}`,
                });
        } else {
            // Update old lift if we are changing equation OR the e1RM is bigger
            if (processedData[liftIndex].graphData[dateIndex].method != equation || oneRepMax > processedData[liftIndex].graphData[dateIndex].y) {
                processedData[liftIndex].graphData[dateIndex].y = oneRepMax;
                processedData[liftIndex].graphData[dateIndex].label = label;
                processedData[liftIndex].graphData[dateIndex].URL = rawLiftData[i].URL;
                processedData[liftIndex].graphData[dateIndex].method = equation;
            } else continue; // Weaker lift, duplicate date. Ignore and go to the next item in the rawLiftData loop
        } 
    }

    console.log(`Processed raw data into ${processedData.length} different types of lifts. (${equation} equation)`);

    // Every element of processedData now has a graphData array
    // Let's sort each graphData array by date (x entry) so it draws lines correctly
    // (FIXME: write a custom YYYY-MM-DD compare function as 'new Date' in a sort function is frowned upon)
    processedData.forEach(arr => arr.graphData.sort((a,b) => new Date(a.x) - new Date(b.x)));

    // Also sort our processedData so the most popular lift types get charts first
    processedData.sort((a, b) => b.graphData.length - a.graphData.length);

    // Use the most popular lift to set some aesthetic x-axis padding at start and end
    padDateMin = new Date(processedData[0].graphData[0].x); 
    padDateMin = padDateMin.setDate(padDateMin.getDate() - 4);
    padDateMax = new Date(processedData[0].graphData[processedData[0].graphData.length-1].x); 
    padDateMax = padDateMax.setDate(padDateMax.getDate() + 14);
}


// Generate annotation config for an achievement
function createAchievement(date, weight, text, background, datasetIndex) {

    return {
            type: 'label',
            borderColor: (ctx) => ctx.chart.data.datasets[datasetIndex].backgroundColor,
            borderRadius: 3,
            borderWidth: 2,
            yAdjust: 20, 
            content: [text],
            xValue: date,
            yValue: weight,
            backgroundColor: background,
            padding: {
                top: 2,
                left: 2,
                right: 2,
                bottom: 1,
            },
            display(chart, options) {
                // Only show if dataset line is visible on chart 
                let meta = chart.chart.getDatasetMeta(datasetIndex);
                if (meta === undefined) return false;
                return meta.visible;
                },
                // scaleID: 'y',
            };
}

// array function to gather interesting achievements from processedData
// called as a foreach method with an extra argument string for equation type
function visualiseAchievements(e, index) {

    if (index >= numChartLines) return; // We can only draw annotations where we have made lines

    if (!e) return;

    equation = this.valueOf(); 

    if (e.best1RM) {
        // Set point annotation for .best1RM
        liftAnnotations[`${e.name}_best_1RM`] = createAchievement(e.best1RM.date, e.best1RM.weight, '1RM', 'rgba(255, 99, 132, 0.25)', index);

        // Update the label with some encouragement 
        let dateIndex = e.graphData.findIndex(lift => lift.x === e.best1RM.date);
        e.graphData[dateIndex].label = `${e.graphData[dateIndex].label} Best ${e.name} 1RM of all time!`;
    }

    if (e.best3RM) {
        // Set point annotation for .best3RM
        let e1rm = estimateE1RM(e.best3RM.reps, e.best3RM.weight, equation);
        liftAnnotations[`${e.name}_best_3RM`] = createAchievement(e.best3RM.date, e1rm, '3RM', 'rgba(255, 99, 132, 0.25)', index);  

        // Update the label with some encouragement 
        let dateIndex = e.graphData.findIndex(lift => lift.x === e.best3RM.date);
        e.graphData[dateIndex].label = `${e.graphData[dateIndex].label} Best ${e.name} 3RM of all time!`;
    }

    if (e.best5RM) {
        // Set point annotation for .best5RM
        let e1rm = estimateE1RM(e.best5RM.reps, e.best5RM.weight, equation);
        liftAnnotations[`${e.name}_best_5RM`] = createAchievement(e.best5RM.date, e1rm, '5RM', 'rgba(255, 99, 132, 0.25)', index);  

        // Update the label with some encouragement 
        let dateIndex = e.graphData.findIndex(lift => lift.x === e.best5RM.date);
        e.graphData[dateIndex].label = `${e.graphData[dateIndex].label} Best ${e.name} 5RM of all time!`;
    };
}

// Parse a row of BTWB data as a liftEntry object into rawLiftData
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

    unitType = row[units_COL]; // Record the units type global for later. (we assume it won't change in the CSV)

    let liftURL = `https://www.barbelllogic.app/workout/${row[workout_id_COL]}`;

    let liftEntry = {
        name: row[exercise_name_COL],
        date: row[workout_date_COL],
        reps: lifted_reps,
        weight: lifted_weight,
        URL: liftURL,
    }
    rawLiftData.push(liftEntry); // add to our collection of raw data
}

// Return a rounded 1 rep max
// For theory see: https://en.wikipedia.org/wiki/One-repetition_maximum 
function estimateE1RM(reps, weight, equation) {
    if (reps == 0) {
            console.error("Somebody passed 0 reps... naughty.");
            return 0;
    }

    if (reps == 1) return parseInt(weight); // FIXME: Preserve 1 decimal? Heavy single requires no estimate! 

    switch (equation) {
        case "Epley":
            return Math.round(weight*(1+reps/30)); 
            break;
        case "Wathen":
            return Math.round(100 * weight/(48.8+53.8*(Math.pow(Math.E, -0.075*reps)))); 
            break;
        default:
            return Math.round(weight/(1.0278-0.0278*reps)); // Brzycki formula
            break;
    }
}

function value(ctx, datasetIndex, index, prop) {
    const meta = ctx.chart.getDatasetMeta(datasetIndex);
    // console.log(JSON.stringify(meta));
    const parsed = meta.controller.getParsed(index);
    return parsed ? parsed[prop] : NaN;
}

// Setup a charts.js chart.
function getChartConfig () {

    // colors = ['rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(0, 0, 255)', 'rgb(50, 150, 150)', 'rgb(100, 100, 0)'];
    colors = ['#ae2012', '#ee9b00', '#03045e', '#0a9396'];

    // Make line config datasets of the most popular lift types
    let dataSets = [];
    for (let i = 0; i < numChartLines; i++) {

        // Check if we have this data to chart, then push it on
        if (processedData[i] && processedData[i].name && processedData[i].graphData)
        dataSets.push({
            label: processedData[i].name,
            backgroundColor: colors[i],
            borderColor: 'rgb(50, 50, 50)',
            borderWidth: 2,
            pointStyle: 'circle',
            radius: 4,
            hitRadius: 20,
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
            // FIXME: we can work out sensible values from our data set and unit type
            x: {min: 'original', max: 'original', minRange: 50},
            y: {min: 'original', max: 'original', minRange: 200},
        },
        pan: {
            enabled: true,
            mode: 'x',
        },
        zoom: {
            wheel: {
            enabled: true,
        },
            pinch: {
            enabled: true
        },
            mode: 'x',
            onZoomComplete({chart}) {
            // This update is needed to display up to date zoom level in the title.
            // Without this, previous zoom level is displayed.
            // The reason is: title uses the same beforeUpdate hook, and is evaluated before zoom.
            //chart.update('none');
            }
        }
    }

    Chart.defaults.font.family = 'Catamaran';

    const config = {
        type: 'line',
        plugins: [ChartDataLabels],
        data: data,
        options: {
            onClick: chartClickHandler,
            plugins: {
                zoom: zoomOptions,
                annotation: {
                    annotations: liftAnnotations,
                },
                datalabels: {
                    formatter: function(context) {
                        return context.y; 
                        },
                    font: function(context) {
                        // Mark heavy singles in bold data labels, and the e1rm estimate data labels as italic
                        let liftSingle = context.dataset.data[context.dataIndex].label.indexOf("Potential");
                        if (liftSingle === -1) 
                            return { weight: 'bold', size: 13, };
                        else 
                            return { style: 'italic', size: 12, };
                    },
                    align: 'end',
                    anchor: 'end',
                },
                tooltip: {
                    enabled: true,
                    position: 'nearest',
                    titleFont: { size:14 },
                    bodyFont: { size:14 },
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
                            size:18
                        }
                    }
                }
            },
            scales: {
                xAxis: {
                    type: 'time',
                    suggestedMin: padDateMin,
                    suggestedMax: padDateMax,
                    time: {
                        minUnit: 'day',
                    },
                },
                yAxis: {
                    suggestedMin: 0, 
                    ticks: {
                        font: {size: 15},
                        callback: function (value) {
                            return value + unitType;
                        },
                    },
                },
            },
        },
    };
    return config;
}

// Used to detect a click on a graph point and open URL in the data.
function chartClickHandler (event, item) {
    if (item && item.length > 0) {
        // console.log(`You clicked this point: ${JSON.stringify(processedData[item[0].datasetIndex].graphData[item[0].index])}`)
        let URL = processedData[item[0].datasetIndex].graphData[item[0].index].URL;
        if (URL) window.open(URL);
    }
}

function resetZoom () {
    if (myChart) myChart.resetZoom();
}


// Callback handlers for equation dropup menu
function equationBrzycki () {
    processRawLiftData("Brzycki");
    processedData.forEach(visualiseAchievements, "Brzycki");
    myChart.update();

}

function equationEpley () {
    processRawLiftData("Epley");
    processedData.forEach(visualiseAchievements, "Epley");
    myChart.update();
}

function equationWathen (context) {
    // Hide the dropup menu on click
    // let element = document.getElementsByClassName("dropup-content");
    // if (element && element.length > 0) element[0].style.display = "none";
    // if (element && element.length > 0) element[0].style.display = "";

    processRawLiftData("Wathen");
    processedData.forEach(visualiseAchievements, "Wathen");
    myChart.update();
}