// One Rep Max Calculator

// Return a rounded 1 rep max
// For theory see: https://en.wikipedia.org/wiki/One-repetition_maximum
function estimateE1RM(reps, weight) {
  if (reps == 0) {
    console.error("Somebody passed 0 reps... naughty.");
    return 0;
  }

  if (reps == 1) return weight; // Heavy single requires no estimate!

  switch (equation) {
    case "Epley":
      return Math.round(weight * (1 + reps / 30));
      break;
    case "McGlothin":
      return Math.round((100 * weight) / (101.3 - 2.67123 * reps));
      break;
    case "Lombardi":
      return Math.round(weight * Math.pow(reps, 0.1));
      break;
    case "Mayhew":
      return Math.round((100 * weight) / (52.2 + 41.9 * Math.pow(Math.E, -0.055 * reps)));
      break;
    case "OConner":
      return Math.round(weight * (1 + reps / 40));
      break;
    case "Wathen":
      return Math.round((100 * weight) / (48.8 + 53.8 * Math.pow(Math.E, -0.075 * reps)));
      break;
    case "Brzycki":
      return Math.round(weight / (1.0278 - 0.0278 * reps));
      break;
    default: // Repeat Brzycki formula as a default here
      return Math.round(weight / (1.0278 - 0.0278 * reps));
      break;
  }
}

// Update the calculator
// Called from the html entry elements via onchange handler
function updateCalculator () {
  let element = document.getElementById('reps');
  if (element.value < 1) element.value = 1; // 1 is the minimum reps
  const reps = element.value;

  element = document.getElementById('weight');
  if (element.value < 1) element.value = 1; // 1 is the minimum weight
  const weight = element.value;

  // Set e1rm
  document.getElementById("potentialE1RM").innerHTML = estimateE1RM(reps, weight);
}