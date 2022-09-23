// Global variables
const rawLiftData = []; // Every unique lift in the source data
const processedData = []; // Array with one element per lift type of charts.js graph friendly data and special achievements
const liftAnnotations = {}; // chart.js annotations plugin config for special achivements such as 1RM, 3RM, 5RM.
let myChart = null;
let chartTitle = "Strength History";
let minChartLines = 3; // How many lifts to show by default
let maxChartLines = 8; // Maximum number to graph - we will order by most popular lifts.
let padDateMin, padDateMax;
let unitType = "lb"; // Default to freedom units
const basicColors = ['#ae2012', '#ee9b00', '#03045e', '#0a9396'];

// ----------------------------------------------------------------------
// createChart - visualize strength history chart
// Takes data array from either CSV file (papaparse) or Google Sheets API
// We expect array format of grid data[][]
// ----------------------------------------------------------------------
function createChart(data) {

  parseData(data); // get our source data into rawLiftData

  // Process rawLiftData into our processedData structure
  // Here we default to Brzycki 1RM estimation equation (user can change in UI later)
  processRawLiftData("Brzycki");

  // If we already have a chart, just update it.
  if (myChart !== null) {
    myChart.update();
    return;
  }

  // Use the most popular lift to set some aesthetic x-axis padding at start and end
  // Right now only do this once on first csv load.
  // There is a chance loading another data set will require a new range, but unlikely.
  padDateMin = new Date(processedData[0].graphData[0].x);
  padDateMin = padDateMin.setDate(padDateMin.getDate() - 4);
  padDateMax = new Date(processedData[0].graphData[processedData[0].graphData.length - 1].x);
  padDateMax = padDateMax.setDate(padDateMax.getDate() + 14);

  // Create the chart.js chart
  let canvas = document.getElementById('myChartCanvas');
  myChart = new Chart(canvas, getChartConfig());

  // Now we have the chart, show the html chart controls box.
  let controlsBox = document.getElementById("chartControlsBox");
  controlsBox.style.visibility = "visible";

  // Hide the file upload button now. We could support later extra uploads in the future.
  let uploadBox = document.getElementById("uploadBox");
  uploadBox.style.display = "none";
}

// Process the rawLiftData array of lifts into processedData (AKA charts.js compatible graph data)
// We collect only the best set per lift type per day, according to highest estimated one rep max
// Passed an string argument for equation - matching those in estimateE1RM() function.
function processRawLiftData(equation) {

  for (const lift of rawLiftData) {

  const liftIndex = getProcessedLiftIndex(lift.name);

  // Main task - find the best e1rm estimate on this date
  let oneRepMax = estimateE1RM(lift.reps, lift.weight, equation);

  // Prepare our data label
  // FIXME: use the unit type in the lift.units, if missing fall back to global unitType
  let label = '';
  if (lift.reps === 1)
      label = `Lifted 1@${lift.weight}${unitType}.`;
    else
      label = `Potential 1@${oneRepMax}${unitType} from ${lift.reps}@${lift.weight}${unitType}.`;

    var url = lift.url;
    if (!url) url = "";

    // Do we already have any processed data on this date?
    let dateIndex = processedData[liftIndex].graphData.findIndex(processedLift => processedLift.x == lift.date);

    if (dateIndex === -1) {
      // Push new lift on this new date (in chartjs friendly format)
      processedData[liftIndex].graphData.push(
      {
        x: lift.date, 
        y: oneRepMax,
        label: label,
        method: equation,
        notes: lift.notes,
        isUpdated: true,
        url: url,
      });
      continue; // Continue iterating through rawLiftData
    }

    // From here dateIndex is valid - we have a matching date.
    // Handle a number of cases where the raw lift date has a date match in the processed graph data.

    // If we are changing equation method, then update the y value
    if (processedData[liftIndex].graphData[dateIndex].method != equation) {
        processedData[liftIndex].graphData[dateIndex].y = oneRepMax;
        processedData[liftIndex].graphData[dateIndex].method = equation;
        continue; // Continue iterating through rawLiftData
    }

    // If this processed lift is stale and is the same e1rm/date as this raw lift, then refresh it 
    // This is important for refreshing data from Google Sheets
    if (processedData[liftIndex].graphData[dateIndex].isUpdated === false && 
      oneRepMax === processedData[liftIndex].graphData[dateIndex].y) {
        processedData[liftIndex].graphData[dateIndex].isUpdated = true;
        continue; // Continue iterating through rawLiftData
    }

    // If the raw lift e1rm is higher than what we had on this date, then update.
    // Because our chart always has the best lift per day
    if (oneRepMax > processedData[liftIndex].graphData[dateIndex].y) {
        processedData[liftIndex].graphData[dateIndex].y = oneRepMax;
        processedData[liftIndex].graphData[dateIndex].label = label;
        processedData[liftIndex].graphData[dateIndex].notes = lift.notes; 
        processedData[liftIndex].graphData[dateIndex].method = equation;
        processedData[liftIndex].graphData[dateIndex].isUpdated = true;
        processedData[liftIndex].graphData[dateIndex].url = url;
        continue; // Continue iterating through rawLiftData
    } 
  }

  console.log(`Processed rawLiftData into ${processedData.length} different types of lifts. (${equation} equation)`);

  // Remove any left over stale items (needed for refreshing data from Google Sheets)
  processedData.forEach(liftType => {
    // Loop backwards through graphdata mutating it to remove stale entries
    for (let i = liftType.graphData.length - 1; i >= 0; i--) {
      if (liftType.graphData[i].isUpdated === false) { 
        // console.log(`Found stale ${liftType.name} graph entry #${i} is ${JSON.stringify(liftType.graphData[i])}`);
        liftType.graphData.splice(i, 1);
      }
    }
  });

  // We now know how many lift types we have. So reduce the number of expected chart lines if needed.
  if (processedData.length < minChartLines) minChartLines = processedData.length;

  // Every element of processedData now has a graphData array
  // Let's sort each graphData array by date (x entry) so it draws lines correctly
  // (FIXME: write a custom YYYY-MM-DD compare function as 'new Date' in a sort function is frowned upon)
  // FIXME: if we presort raw lift data, then graphdata will already be sorted
  processedData.forEach(arr => arr.graphData.sort((a,b) => new Date(a.x) - new Date(b.x)));

  // Also sort our processedData so the most popular lift types get charts first
  processedData.sort((a, b) => b.graphData.length - a.graphData.length);

  // Find achievements and put on chart
  processAchievements("Brzycki");
}

// Find interesting achievements and add to chart annotation config
// We pass through the equation type as it is needed to know the label y position
function processAchievements(equation) {

  // Clear old achievements from our data and from the chart annotations config
  processedData.forEach(liftType => {
      if (liftType.best1RM) liftType.best1RM = null;
      if (liftType.best3RM) liftType.best3RM = null;
      if (liftType.best5RM) liftType.best5RM = null;
  });
  for (var member in liftAnnotations) delete liftAnnotations[member];

  // Iterate through rawLiftData and put achievements into processedData
  for (const lift of rawLiftData) {

    const liftIndex = getProcessedLiftIndex(lift.name);

    // Assuming that the data is sorted reverse chronological, we award the achievements to the oldest lift.
    switch (lift.reps) {
      case 5:
      if (processedData[liftIndex].best5RM === null || lift.weight >= processedData[liftIndex].best5RM.weight)
        processedData[liftIndex].best5RM = lift;
      break;
    case 3:
        if (processedData[liftIndex].best3RM === null || lift.weight >= processedData[liftIndex].best3RM.weight)
         processedData[liftIndex].best3RM = lift;
        break;
    case 1:
        if (processedData[liftIndex].best1RM === null || lift.weight >= processedData[liftIndex].best1RM.weight)
        processedData[liftIndex].best1RM = lift;
        break;
    }
  }

  // Iterate through each lift in processedData and convert any achievements into chart annotation config
  processedData.forEach((e, index) => {

    if (index >= maxChartLines) return; // We can only draw annotations where we have made lines

    if (e.best1RM) {
      // Set point annotation for .best1RM
      liftAnnotations[`${e.name}_best_1RM`] = createAchievementAnnotation(e.best1RM.date, e.best1RM.weight, '1RM', 'rgba(255, 99, 132, 0.25)', index);

      // Update the label with some encouragement
      const dateIndex = e.graphData.findIndex(lift => lift.x === e.best1RM.date);
      e.graphData[dateIndex].achievements = `Best ${e.name} 1RM of all time!`;
    }

    if (e.best3RM) {
      // Set point annotation for .best3RM
      let e1rm = estimateE1RM(e.best3RM.reps, e.best3RM.weight, equation);
      liftAnnotations[`${e.name}_best_3RM`] = createAchievementAnnotation(e.best3RM.date, e1rm, '3RM', 'rgba(255, 99, 132, 0.25)', index);

      // Update the label with some encouragement
      const dateIndex = e.graphData.findIndex(lift => lift.x === e.best3RM.date);
      e.graphData[dateIndex].achievements = `Best ${e.name} 3RM of all time!`;
    }

    if (e.best5RM) {
      // Set point annotation for .best5RM
      let e1rm = estimateE1RM(e.best5RM.reps, e.best5RM.weight, equation);
      liftAnnotations[`${e.name}_best_5RM`] = createAchievementAnnotation(e.best5RM.date, e1rm, '5RM', 'rgba(255, 99, 132, 0.25)', index);

      // Update the label with some encouragement
      const dateIndex = e.graphData.findIndex(lift => lift.x === e.best5RM.date);
      e.graphData[dateIndex].achievements = `Best ${e.name} 5RM of all time!`;
    }
  });
}

// Generate chart.js annotation plugin config data for an achievement
function createAchievementAnnotation(date, weight, text, background, datasetIndex) {
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

// Return a rounded 1 rep max
// For theory see: https://en.wikipedia.org/wiki/One-repetition_maximum
function estimateE1RM(reps, weight, equation) {
  if (reps == 0) {
      console.error("Somebody passed 0 reps... naughty.");
      return 0;
  }

  if (reps == 1) return weight; // Heavy single requires no estimate!

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

// Prepare for a data source reload while preserving as much chart as possible.
// Normally used when we refresh the data from google sheets.
function prepareDataRefresh(replaceData) {
  // Empty the rawLiftData array
  // This assumes we are loading a similar dataset.
  // Do not do this when concatenatng a complementary data source.
  if (replaceData) {
    rawLiftData.splice(0, rawLiftData.length); // empty the array
  }

  // Iterate through processedData and mark everything as stale
  processedData.forEach(liftType => {
      liftType.graphData.forEach(lift => {
        lift.isUpdated = false;
      });
  });
}


// Push our first num processedData into chart.js datasets
// max = number of data sets to create
// min = the default number that display (the rest will begin hidden)
function createDataSets(min, max) {

  const dataSets = [];

  let hidden = false;

  for (let i = 0; i < max; i++) {

    // Choose a beautiful color
    let color;
    const randomColor = `#${Math.floor(Math.random()*16777215).toString(16)}`;

    color = (i >= min) ? randomColor : basicColors[i];

    if (i >= min) hidden = true; // Initially hide the lines above the minimum

    // Check if we have this data to chart, then push it on
    if (processedData[i] && processedData[i].name && processedData[i].graphData)
      dataSets.push({
        label: processedData[i].name,
        backgroundColor: color,
        borderColor: 'rgb(50, 50, 50)',
        borderWidth: 2,
        pointStyle: 'circle',
        radius: 4,
        hitRadius: 20,
        hoverRadius: 10,
        cubicInterpolationMode: 'monotone',
        hidden: hidden,
        data: processedData[i].graphData,
      });
  }
  return dataSets;
 }

// Setup a charts.js chart.
function getChartConfig () {

  const data = {
    datasets: createDataSets(minChartLines, maxChartLines),
  };

  const zoomOptions = {
    limits: {
      // FIXME: we can work out sensible values from our data set and unit type
      x: { min: 'original', max: 'original', minRange: 50 },
      y: { min: 'original', max: 'original', minRange: 200 },
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
    },
  };

  Chart.defaults.font.family = 'Catamaran';

  const config = {
    type: 'line',
    plugins: [ChartDataLabels],
    data: data,
    options: {
      onClick: chartClickHandler,
      plugins: {
        title: {
          text: chartTitle,
          display: true,
          font: { size: 18 },
        },
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
            const liftSingle = context.dataset.data[context.dataIndex].label.indexOf("Potential");
            if (liftSingle === -1)
              return { weight: 'bold', size: 13 };
            else
              return { style: 'italic', size: 12 };
          },
          align: 'end',
          anchor: 'end',
        },
        tooltip: {
          enabled: true,
          position: 'nearest',
          titleFont: { size: 14 },
          bodyFont: { size: 14 },
          callbacks: {
            title: function(context) {
              const d = new Date(context[0].parsed.x)
              const formattedDate = d.toLocaleString([], {
                year:   'numeric',
                month:  'long',
                day:   'numeric',
              });
               return(formattedDate);
            },
            label: function(context) {
              return context.raw.label; // Tooltip information about the lift
            },
            afterLabel: function(context) {
              const labels = [];
              if (context.raw.notes) labels.push(context.raw.notes);
              if (context.raw.achievements) labels.push(context.raw.achievements);
              return labels; // Tooltip information about any achievements
            },
            footer: function(context) {
              const url = context[0].raw.url;
              if (url) return `Click to open ${url}`; // Tooltip reminder they can click to open video
            }
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
            font: { size: 15 },
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
    const url = processedData[item[0].datasetIndex].graphData[item[0].index].url;
    if (url) window.open(url);
  }
}

function resetZoom () {
  if (myChart) myChart.resetZoom();
}

// Callback handlers for equation html dropup menu
function equationEpley () { processRawLiftData("Epley"); myChart.update(); }
function equationBrzycki () { processRawLiftData("Brzycki"); myChart.update(); }
function equationMcGlothin () { processRawLiftData("McGlothin"); myChart.update(); }
function equationLombardi () { processRawLiftData("Lombardi"); myChart.update(); }
function equationMayhew () { processRawLiftData("Mayhew"); myChart.update(); }
function equationOConner () { processRawLiftData("OConner"); myChart.update(); }
function equationWathen (context) { processRawLiftData("Wathen"); myChart.update(); }

// Show/hide the chart.js achievement annotations on the chart
function toggleAchievements (context) {
  const toggleAchInput = document.getElementById("toggleAchievements");
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

// Callback function for html upload file button
// Use Papaparse to process whatever file is given via the html file picker
function readCSV(context) {
  const reader = new FileReader;

  reader.onload = function () {
    const data = Papa.parse(reader.result, { dynamicTyping: true });

    // More than 10 errors might indicate it's a jpg or something non CSV
    if (data.meta.aborted || data.errors.length > 10) {
      console.error("Papaparse detected too many errors in file input. Do you even lift?")
      return null;
    }

    // Are we loading over an existing chart? 
    // This is either a refresh or a concatenation event
    // Refresh means add or remove any changes between the new and old data
    // Concatenate means add both datasets together into the chart
    // FIXME: make this a UI option somehow.
    // For now we treat it like a refresh
    if (myChart !== null) prepareDataRefresh(true);

    chartTitle = fileInput.files[0].name;
    createChart(data.data);
  }

  // Start reading the file. When it is done, calls the onload event defined above.
  reader.readAsText(fileInput.files[0]);
}


// Return the index for the liftType string in our processedData
// If the lift doesn't exist in processedData, create one.
function getProcessedLiftIndex (liftType) {
  let liftIndex = processedData.findIndex(lift => lift.name === liftType);

  if (liftIndex === -1) {
    // Create a processedLift data structure for this new lift type
    let processedLiftType = {
      name: liftType,
      graphData: [],
      best5RM: null,
      best3RM: null,
      best1RM: null
    };
  liftIndex = processedData.push(processedLiftType) - 1;
  }

  return liftIndex;
}