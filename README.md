# powerlifting_strength_tracker_js
## A javascript based strength history visualiser 

Click here to use the deployed version: https://wayneschuller.github.io/powerlifting_strength_tracker_js/e1rm.html
You can then click on the file chooser to select a CSV file of your lifts.

Currently supported CSV formats:
- [Barbell Logic](https://barbell-logic.com/) client web app
- [Beyond the Whiteboard](https://beyondthewhiteboard.com/) web app
- more file formats coming soon including a DIY format

The code will use charts.js to generate a time based graph of your lifts based on an estimated one rep max:
![20220904_squat](https://user-images.githubusercontent.com/1592295/188308389-69f136b0-9e68-45b7-bac0-60fda94a9e06.png)

You can compare relative progress for different rep ranges of the same lift. If you hover the mouse over a data point it will show which reps and weight produced that estimated data point.

I am using this project to learn a number of different web technologies so the code is not always polished.

This project relies on the following open source projects: 
- [chart.js](https://www.chartjs.org/)
- [chart.js data labels plugin](https://github.com/chartjs/chartjs-plugin-datalabels)
- [chart.js date adaptor plugin](https://github.com/chartjs/chartjs-adapter-date-fns)
- [chart.js zoom plugin](https://www.chartjs.org/chartjs-plugin-zoom/latest/)
- [chart.js annotation plugin](https://www.chartjs.org/chartjs-plugin-annotation/latest/)
- [Papa Parse](https://www.papaparse.com/) CSV processor.
- and some underlying libraries

This open source project is _not_ affiliated or endorsed by any of the above fitness companies.
