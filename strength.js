// Global variables
const rawLiftData = []; // Every unique lift in the source data
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

            parseCSV(data);

            // We now have the rawLiftData from various sources.
            // Process that data into our processedData structure
            // Here we always default to Brzycki 1RM estimation equation (user can change in UI later)
            processRawLiftData("Brzycki");
            
            // Use the most popular lift to set some aesthetic x-axis padding at start and end
            // Right now only do this once on first csv load.
            // There is a chance loading another data set will require a new range, but unlikely.
            padDateMin = new Date(processedData[0].graphData[0].x); 
            padDateMin = padDateMin.setDate(padDateMin.getDate() - 4);
            padDateMax = new Date(processedData[0].graphData[processedData[0].graphData.length-1].x); 
            padDateMax = padDateMax.setDate(padDateMax.getDate() + 14);

            let canvas = document.getElementById('myChartCanvas');
            myChart = new Chart(canvas, getChartConfig());

            // Process achievements and display them after creation
            processedData.forEach(visualiseAchievements, "Brzycki");
            myChart.update();

            // Now we have the chart, show the chart controls box.
            let controlsBox = document.getElementById("chartControlsBox");
            controlsBox.style.visibility = "visible";

            // Hide the file upload button now. We could support multiple uploads in the future.
            // FIXME: this is not working 
            let uploadBox = document.getElementById("uploadBox");
            uploadBox.style.display = "none";
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
            // Create a processedLift data structure for this new lift type
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
        // FIXME: use the unit type in the rawLiftData[i].units, if missing fall back to global unitType
        let label = '';
        if (rawLiftData[i].reps === 1)
            label = `Lifted 1@${rawLiftData[i].weight}${unitType}.`;
        else
            label = `Potential 1@${oneRepMax}${unitType} from ${rawLiftData[i].reps}@${rawLiftData[i].weight}${unitType}.`;

        let url = rawLiftData[i].url;
        if (!url) url = "";

        // Do we already have any processed data on this date?
        let dateIndex = processedData[liftIndex].graphData.findIndex(lift => lift.x === rawLiftData[i].date);
        if (dateIndex === -1) {
            // Push new lift on this new date (in chartjs friendly format)
            processedData[liftIndex].graphData.push(
                {   
                    x:rawLiftData[i].date, 
                    y: oneRepMax, 
                    label:`${label}`, 
                    url: url,
                    method: `${equation}`,
                });
        } else {
            // Update old lift if we are changing equation OR the e1RM is bigger
            if (processedData[liftIndex].graphData[dateIndex].method != equation || oneRepMax > processedData[liftIndex].graphData[dateIndex].y) {
                processedData[liftIndex].graphData[dateIndex].y = oneRepMax;
                processedData[liftIndex].graphData[dateIndex].label = label;
                processedData[liftIndex].graphData[dateIndex].method = equation;

                // FIXME: if we have a URL in each, choose the non-BLOC one
                processedData[liftIndex].graphData[dateIndex].url = url;
            } else continue; // Weaker lift, duplicate date. Ignore and go to the next item in the rawLiftData loop
        } 
    }

    console.log(`Processed raw data into ${processedData.length} different types of lifts. (${equation} equation)`);

    // We now know how many lift types we have. So reduce the number of expected chart lines if needed.
    if (processedData.length < numChartLines) numChartLines = processedData.length;

    // Every element of processedData now has a graphData array
    // Let's sort each graphData array by date (x entry) so it draws lines correctly
    // (FIXME: write a custom YYYY-MM-DD compare function as 'new Date' in a sort function is frowned upon)
    processedData.forEach(arr => arr.graphData.sort((a,b) => new Date(a.x) - new Date(b.x)));

    // Also sort our processedData so the most popular lift types get charts first
    processedData.sort((a, b) => b.graphData.length - a.graphData.length);

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

    equation = this.valueOf(); // Grab the extra string data that was passed to the function

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
        case "McGlothin":
            return Math.round(100 * weight/(101.3 - 2.67123 * reps)); 
            break;
        case "Lombardi":
            return Math.round(weight*Math.pow(reps, 0.10)); 
            break;
        case "Mayhew":
            return Math.round(100 * weight/(52.2 + 41.9*Math.pow(Math.E, -0.055*reps))); 
            break;
        case "OConner":
            return Math.round(weight*(1 + reps/40)); 
            break;
        case "Wathen":
            return Math.round(100 * weight/(48.8+53.8*(Math.pow(Math.E, -0.075*reps)))); 
            break;
        default:
            return Math.round(weight/(1.0278-0.0278*reps)); // Brzycki formula is our default
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
        let url = processedData[item[0].datasetIndex].graphData[item[0].index].url;
        if (url) window.open(url);
    }
}

function resetZoom () {
    if (myChart) myChart.resetZoom();
}


// Callback handlers for equation dropup menu
function equationEpley () {
    processRawLiftData("Epley");
    processedData.forEach(visualiseAchievements, "Epley");
    myChart.update();
}

function equationBrzycki () {
    processRawLiftData("Brzycki");
    processedData.forEach(visualiseAchievements, "Brzycki");
    myChart.update();

}

function equationMcGlothin () {
    processRawLiftData("McGlothin");
    processedData.forEach(visualiseAchievements, "McGlothin");
    myChart.update();
}

function equationLombardi () {
    processRawLiftData("Lombardi");
    processedData.forEach(visualiseAchievements, "Lombardi");
    myChart.update();
}

function equationMayhew () {
    processRawLiftData("Mayhew");
    processedData.forEach(visualiseAchievements, "Mayhew");
    myChart.update();
}

function equationOConner () {
    processRawLiftData("OConner");
    processedData.forEach(visualiseAchievements, "OConner");
    myChart.update();
}

function equationWathen (context) {
    processRawLiftData("Wathen");
    processedData.forEach(visualiseAchievements, "Wathen");
    myChart.update();
}

// Show/hide the chart.js achievement annotations on the chart
function toggleAchievements (context) {
    let toggleAchInput = document.getElementById("toggleAchievements");
    if (toggleAchInput.value == "Hide") {
        toggleAchInput.value = "Show";
        toggleAchInput.innerHTML = "Show Achievements";

        // The user wants to hide achievements overlay
        myChart.config.options.plugins.annotation.annotations = null;

    } else {
        toggleAchInput.value = "Hide";
        toggleAchInput.innerHTML = "Hide Achievements";

        // The user wants to show achievements overlay
        myChart.config.options.plugins.annotation.annotations = liftAnnotations;
    }

    myChart.update();
}