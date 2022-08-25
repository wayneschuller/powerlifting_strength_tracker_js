# powerlifting_strength_tracker_js
A javascript based powerlifting graph tracker (processes data from Beyond the Whiteboard and Barbell Logic)

Download the e1rm.html and strength.js into the same folder and open e1rm.html in your web browser.

You can then click on the file chooser to select a CSV file of your lifts.

Currently supported CSV formats:
- [Barbell Logic](https://barbell-logic.com/) client web app
- [Beyond the Whiteboard](https://beyondthewhiteboard.com/) web app
- more file formats coming soon including a DIY format

The code will use charts.js to generate a time based graph of your lifts based on an estimated one rep max:
![strength_tracker_sample](https://user-images.githubusercontent.com/1592295/186638017-abfefe15-9aba-4778-93e8-ea27c016ff09.jpg)

You can compare relative progress for different rep ranges of the same lift. If you hover the mouse over a data point it will show which reps and weight produced that estimated data point.

I am using this project to learn a number of different web technologies so the code is not always polished.

This project relies on the following opensource projects: 
- [charts.js](https://www.chartjs.org/)
- charts.js data adaptor plugin
- charts.js zoom plugin
- [Papa Parse](https://www.papaparse.com/) CSV processor.

This open source project is _not_ affiliated or endorsed by any of the above fitness companies.
